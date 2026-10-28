import { describe, expect, it } from "vitest";
import {
  adReadiness,
  analyzePost,
  extractHook,
  preflight,
  suggestHooks,
  analyzeHook,
} from "@/lib/growth/post-quality";

describe("analyzePost", () => {
  it("counts characters, words, hashtags and links", () => {
    const body =
      "Como dobrar o alcance em 7 dias? #marketing #dicas\nVeja https://exemplo.com @perfil";
    const s = analyzePost(body, "instagram");
    expect(s.hashtags).toBe(2);
    expect(s.mentions).toBe(1);
    expect(s.links).toBe(1);
    expect(s.words).toBeGreaterThan(5);
    expect(s.chars).toBe([...body].length);
  });

  it("captures characters visible before the platform collapses the caption", () => {
    const body = "a".repeat(300);
    expect(analyzePost(body, "instagram").visibleChars).toBe(125);
    expect(analyzePost(body, "linkedin").visibleChars).toBe(210);
  });
});

describe("extractHook", () => {
  it("returns the first meaningful line", () => {
    expect(extractHook("Primeira linha forte.\nSegunda linha.")).toBe("Primeira linha forte.");
  });

  it("extends a single-word first line to the next line", () => {
    expect(extractHook("ERRO\nque quase me custou o negócio")).toBe(
      "ERRO que quase me custou o negócio",
    );
  });

  it("handles empty input", () => {
    expect(extractHook("   \n  ")).toBe("");
  });
});

describe("analyzeHook", () => {
  it("penalises self-centred openers", () => {
    const weak = analyzeHook("Hoje eu quero falar sobre uma coisa importante", "instagram");
    const strong = analyzeHook(
      "Perdi 2 clientes por causa de um erro bobo no orçamento",
      "instagram",
    );
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(weak.problems.some((p) => p.id === "hook.weak-opener")).toBe(true);
  });

  it("rewards concrete numbers and confessed mistakes", () => {
    const r = analyzeHook("3 erros que me custaram R$ 4.000 em 2 meses", "instagram");
    expect(r.strengths.length).toBeGreaterThan(0);
    expect(r.score).toBeGreaterThan(55);
  });

  it("flags a hook longer than the visible limit", () => {
    const r = analyzeHook("palavra ".repeat(30), "instagram");
    expect(r.problems.some((p) => p.id === "hook.too-long")).toBe(true);
  });
});

describe("preflight", () => {
  it("blocks a caption over the platform limit", () => {
    const r = preflight({ body: "x".repeat(400), platform: "x" }); // limite do X = 280
    expect(r.passed).toBe(false);
    expect(r.blockers.some((b) => b.id === "body.too-long")).toBe(true);
  });

  it("blocks platforms that require media when none is attached", () => {
    const r = preflight({ body: "Texto válido sobre café.", platform: "tiktok" });
    expect(r.passed).toBe(false);
    expect(r.blockers.some((b) => b.id === "media.required")).toBe(true);
  });

  it("passes a well-formed instagram post with media", () => {
    const r = preflight({
      body: "3 erros que travam sua primeira venda\n\nSalve este post. #vendas #empreendedorismo",
      platform: "instagram",
      mediaCount: 1,
    });
    expect(r.passed).toBe(true);
    expect(r.score).toBeGreaterThan(60);
  });

  it("warns when a non-clickable platform receives a link", () => {
    const r = preflight({
      body: "Conteúdo bom com link https://exemplo.com no corpo",
      platform: "instagram",
      mediaCount: 1,
    });
    expect(r.warnings.some((w) => w.id === "link.not-clickable")).toBe(true);
  });

  it("rejects unknown platforms instead of silently publishing", () => {
    const r = preflight({ body: "texto", platform: "orkut" });
    expect(r.passed).toBe(false);
    expect(r.blockers[0].id).toBe("platform.unsupported");
  });

  it("is deterministic — same input yields identical output", () => {
    const input = { body: "Teste de determinismo com número 42", platform: "linkedin" };
    expect(preflight(input)).toEqual(preflight(input));
  });
});

describe("suggestHooks", () => {
  it("derives alternatives from the post's own content", () => {
    const s = suggestHooks(
      "Aprendi que precificar por hora destrói a margem. Depois de 3 anos cobrando errado, mudei o modelo.",
      "linkedin",
    );
    expect(s.length).toBeGreaterThanOrEqual(2);
    s.forEach((x) => expect(x.text.length).toBeGreaterThan(0));
  });

  it("respects the platform visible limit", () => {
    const long = "frase muito longa ".repeat(20);
    suggestHooks(long, "instagram").forEach((x) => {
      expect([...x.text].length).toBeLessThanOrEqual(125);
    });
  });

  it("returns nothing for an empty body", () => {
    expect(suggestHooks("   ", "instagram")).toHaveLength(0);
  });
});

describe("adReadiness", () => {
  it("rates a concrete, CTA-driven post as paid-ready", () => {
    const r = adReadiness(
      "Seu perfil tem 3 erros que custam clientes todos os dias.\n\nAgende uma auditoria gratuita e veja os 3 primeiros.",
      "instagram",
    );
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.verdict).toBe("ready");
    expect(r.reusableAsCreative).toBe(true);
  });

  it("flags a vague, self-centred post as organic-only", () => {
    const r = adReadiness(
      "Hoje eu estou muito feliz com o que construímos juntos nessa semana",
      "instagram",
    );
    expect(r.verdict).toBe("organic-only");
    expect(r.reusableAsCreative).toBe(false);
  });

  it("penalises multiple links because attribution breaks", () => {
    const one = adReadiness("3 erros que custam vendas. Clique e veja o checklist.", "instagram");
    const many = adReadiness(
      "3 erros que custam vendas. Clique e veja o checklist. https://a.com https://b.com",
      "instagram",
    );
    expect(many.score).toBeLessThan(one.score);
  });

  it("always explains itself", () => {
    const r = adReadiness("texto simples", "linkedin");
    expect(r.reasons.length).toBeGreaterThan(2);
  });
});
