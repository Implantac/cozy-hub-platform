import { describe, expect, it } from "vitest";
import {
  coachableIssues,
  isTextFixable,
  judgeRewrite,
  selectBestRewrites,
  snapshotDraft,
  type CandidateRewrite,
} from "@/lib/growth/rewrite-gate";

/**
 * These tests exist to hold one promise: a model's suggestion is never shown
 * unless the deterministic engine confirms it fixed what it claimed to fix.
 *
 * The most important assertions are the *rejections*. Anyone can write a test
 * that the happy path works; the product's credibility rests on the cases where
 * the AI is confidently wrong.
 */

const WEAK_DRAFT = `Oi gente, hoje eu vim falar um pouquinho do nosso novo pão de fermentação natural, feito com muito carinho aqui na Vila Nova.

Passa lá na padaria!`;
const STRONG_DRAFT = `Fermentação de 24h: o pão que chega quentinho às 7h na Vila Nova.

Passa lá na padaria!`;

describe("snapshotDraft", () => {
  it("captures the diagnosed issues of a weak draft", () => {
    const snap = snapshotDraft({ body: WEAK_DRAFT, platform: "instagram" });
    expect(snap.issueIds.has("hook.weak-opener")).toBe(true);
    expect(snap.score).toBeLessThan(70);
  });

  it("gives a concrete hook a higher score than a weak one", () => {
    const weak = snapshotDraft({ body: WEAK_DRAFT, platform: "instagram" });
    const strong = snapshotDraft({ body: STRONG_DRAFT, platform: "instagram" });
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.issueIds.has("hook.weak-opener")).toBe(false);
  });
});

describe("judgeRewrite — the rejections", () => {
  const original = snapshotDraft({ body: WEAK_DRAFT, platform: "instagram" });

  it("rejects a rewrite that does not actually remove the cited issue", () => {
    // Classic AI failure: claims to fix the opener, opens with another weak one.
    const verdict = judgeRewrite(original, {
      body: `Hoje eu quero contar sobre o pão de fermentação natural da Vila Nova.

Passa lá!`,
      rationale: "Trocamos a abertura por algo mais direto.",
      addresses: "hook.weak-opener",
    });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toBe("not_addressed");
  });

  it("rejects an empty rewrite", () => {
    const verdict = judgeRewrite(original, {
      body: "   ",
      rationale: "x",
      addresses: "hook.weak-opener",
    });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toBe("empty");
  });

  it("rejects a rewrite that only changes whitespace", () => {
    const verdict = judgeRewrite(original, {
      body: WEAK_DRAFT.replace(/\n/g, "\n\n") + "   ",
      rationale: "Reorganizamos o texto.",
      addresses: "hook.weak-opener",
    });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toBe("unchanged");
  });

  it("rejects an invented issue id", () => {
    const verdict = judgeRewrite(original, {
      body: STRONG_DRAFT,
      rationale: "Corrigimos tudo.",
      addresses: "hook.invented",
    });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toBe("unknown_issue");
  });

  it("rejects a rewrite that claims to fix an issue the draft never had", () => {
    const clean = snapshotDraft({ body: STRONG_DRAFT, platform: "instagram" });
    const verdict = judgeRewrite(clean, {
      body: "Oi gente, nosso pão é bom.",
      rationale: "Melhoramos a abertura.",
      addresses: "hook.weak-opener",
    });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toBe("unknown_issue");
  });

  it("rejects a rewrite that lowers the score", () => {
    const original2 = snapshotDraft({ body: STRONG_DRAFT, platform: "instagram" });
    const verdict = judgeRewrite(original2, {
      body: "Confira nosso pão.",
      rationale: "Deixamos mais curto.",
      addresses: "link.multiple",
    });
    expect(verdict.accepted).toBe(false);
    expect(["score_regressed", "unknown_issue", "not_addressed"]).toContain(verdict.reason);
  });
});

describe("judgeRewrite — the acceptance", () => {
  it("accepts a rewrite that removes the cited issue and does not regress", () => {
    const original = snapshotDraft({ body: WEAK_DRAFT, platform: "instagram" });
    const verdict = judgeRewrite(original, {
      body: STRONG_DRAFT,
      rationale: "Trocamos a abertura por um dado concreto: 24h de fermentação.",
      addresses: "hook.weak-opener",
    });

    expect(verdict.reason).toBe("ok");
    expect(verdict.accepted).toBe(true);
    expect(verdict.fixed).toContain("hook.weak-opener");
    expect(verdict.newScore).toBeGreaterThanOrEqual(original.score);
  });

  it("records exactly which issues were fixed and introduced", () => {
    const original = snapshotDraft({ body: WEAK_DRAFT, platform: "instagram" });
    const verdict = judgeRewrite(original, {
      body: STRONG_DRAFT,
      rationale: "Abertura por dado concreto.",
      addresses: "hook.weak-opener",
    });
    expect(verdict.fixed.length).toBeGreaterThan(0);
    expect(verdict.introduced).toHaveLength(0);
  });
});

describe("selectBestRewrites", () => {
  const original = snapshotDraft({ body: WEAK_DRAFT, platform: "instagram" });

  it("keeps only accepted rewrites", () => {
    const candidates: CandidateRewrite[] = [
      { body: STRONG_DRAFT, rationale: "boa", addresses: "hook.weak-opener" },
      { body: "Hoje eu vou falar do pão.", rationale: "ruim", addresses: "hook.weak-opener" },
    ];
    const picked = selectBestRewrites(original, candidates);
    expect(picked).toHaveLength(1);
    expect(picked[0].candidate.body).toBe(STRONG_DRAFT);
  });

  it("deduplicates near-identical rewrites", () => {
    const candidates: CandidateRewrite[] = [
      { body: STRONG_DRAFT, rationale: "a", addresses: "hook.weak-opener" },
      { body: STRONG_DRAFT + "  ", rationale: "b", addresses: "hook.weak-opener" },
    ];
    expect(selectBestRewrites(original, candidates)).toHaveLength(1);
  });

  it("never returns more than three suggestions", () => {
    const bodies = [
      "Fermentação de 24h: o pão chega quentinho às 7h.",
      "Como fazemos pão de fermentação natural em 24h?",
      "Ninguém na Vila Nova fazia pão de 24h. Agora fazemos.",
      "3 erros que deixam o pão pesado — e como evitamos.",
      "Antes: pão de 2h. Depois: 24h de fermentação.",
    ];
    const candidates = bodies.map((body, i) => ({
      body,
      rationale: `alt ${i}`,
      addresses: "hook.weak-opener",
    }));
    const picked = selectBestRewrites(original, candidates);
    expect(picked.length).toBeLessThanOrEqual(3);
    expect(picked.length).toBeGreaterThan(0);
  });
});

describe("isTextFixable", () => {
  it("does not claim a text rewrite can supply missing media", () => {
    // No caption rewrite makes an image exist. Offering one would be the exact
    // "confident but useless" advice this product is built to avoid.
    expect(isTextFixable("media.required")).toBe(false);
  });

  it("treats hook problems as fixable", () => {
    expect(isTextFixable("hook.weak-opener")).toBe(true);
    expect(isTextFixable("hook.too-long")).toBe(true);
  });
});

describe("coachableIssues", () => {
  it("returns the fixable issues of a weak draft, worst first", () => {
    const snap = snapshotDraft({ body: WEAK_DRAFT, platform: "instagram" });
    const issues = coachableIssues(snap);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => isTextFixable(i.id))).toBe(true);
    const ranks = issues.map((i) =>
      i.severity === "blocker" ? 3 : i.severity === "warning" ? 2 : 1,
    );
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
  });

  it("does not repeat the same issue id", () => {
    const snap = snapshotDraft({ body: WEAK_DRAFT, platform: "instagram" });
    const ids = coachableIssues(snap).map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
