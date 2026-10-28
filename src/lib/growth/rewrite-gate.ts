/**
 * VELT — AI rewrite gate (pure, testable).
 *
 * The product rule that shapes this file: **the AI suggests, the deterministic
 * engine decides.** An LLM can produce a beautiful rewrite that still opens with
 * "oi gente" or blows past the caption limit — it does not know the platform
 * rules and it cannot be trusted to grade its own work. So every suggestion the
 * model returns is diffed against the original draft here, in pure code:
 *
 *   accepted  ⇔ the cited problem is gone  ∧  no new blocker appeared
 *                                          ∧  the score did not go down
 *
 * Anything that fails is discarded rather than shown with a caveat. A rewrite
 * that is "mostly better" is worse than no rewrite: the user would publish it
 * trusting a score that their own draft no longer deserves.
 *
 * This module deliberately imports nothing from the network. It is the boundary
 * between probabilistic output and a product that promises verifiable advice.
 */

import { adReadiness, analyzeHook, preflight, type QualityIssue } from "./post-quality";

/** Issue ids the coach is allowed to claim it fixed. */
export type FixableIssue =
  | "hook.weak-opener"
  | "hook.noise"
  | "hook.bait"
  | "hook.too-long"
  | "hook.promise"
  | "hook.concrete"
  | "hook.question"
  | "hook.lesson"
  | "link.multiple";

export interface CandidateRewrite {
  /** The full rewritten caption, not just the hook. */
  body: string;
  /** One sentence, PT-BR: what changed and why it matters. */
  rationale: string;
  /** Which diagnosed issue this rewrite is meant to fix. */
  addresses: string;
}

export interface OriginalSnapshot {
  body: string;
  platform: string;
  title?: string | null;
  mediaCount: number;
  score: number;
  adScore: number;
  blockers: QualityIssue[];
  warnings: QualityIssue[];
  /** Issue ids present in the original, including hook-level ones. */
  issueIds: Set<string>;
}

/** Everything the deterministic engine knows about one draft. */
export function snapshotDraft(input: {
  body: string;
  platform: string;
  title?: string | null;
  mediaCount?: number;
}): OriginalSnapshot {
  const check = preflight({
    body: input.body,
    title: input.title ?? null,
    platform: input.platform,
    mediaCount: input.mediaCount ?? 0,
  });
  const hook = analyzeHook(input.body, input.platform);
  const ad = adReadiness(input.body, input.platform);

  const issueIds = new Set<string>([
    ...check.blockers.map((i) => i.id),
    ...check.warnings.map((i) => i.id),
    ...check.tips.map((i) => i.id),
    ...hook.problems.map((i) => i.id),
  ]);

  return {
    body: input.body,
    platform: input.platform,
    title: input.title ?? null,
    mediaCount: input.mediaCount ?? 0,
    score: check.score,
    adScore: ad.score,
    blockers: check.blockers,
    warnings: check.warnings,
    issueIds,
  };
}

export type VerdictReason =
  | "ok"
  | "empty"
  | "unchanged"
  | "not_addressed"
  | "new_blocker"
  | "score_regressed"
  | "unknown_issue";

export interface Verdict {
  accepted: boolean;
  reason: VerdictReason;
  /** Score after applying the rewrite; null when the rewrite was not scored. */
  newScore: number | null;
  /** Issues the rewrite actually removed. */
  fixed: string[];
  /** Issues the rewrite introduced. */
  introduced: string[];
  /** Blocker titles, for the audit trail. */
  newBlockers: string[];
}

/**
 * The issues that a *rewrite of the text* can plausibly fix.
 *
 * `media.required` is excluded on purpose: no caption rewrite makes an image
 * exist. Offering a text rewrite for a missing video would be the kind of
 * confident-but-useless advice this product exists to avoid.
 */
const TEXT_FIXABLE = new Set<string>([
  "body.empty",
  "hook.weak-opener",
  "hook.noise",
  "hook.bait",
  "hook.too-long",
  "hook.promise",
  "hook.concrete",
  "hook.question",
  "hook.lesson",
  "link.multiple",
]);

export function isTextFixable(issueId: string): boolean {
  return TEXT_FIXABLE.has(issueId);
}

/** Issues that make a rewrite worth requesting at all, most costly first. */
export function coachableIssues(snapshot: OriginalSnapshot): QualityIssue[] {
  const hook = analyzeHook(snapshot.body, snapshot.platform);
  const all = [
    ...snapshot.blockers,
    ...snapshot.warnings,
    ...hook.problems,
    ...(allTips(snapshot) ?? []),
  ];
  const seen = new Set<string>();
  return all
    .filter((i) => {
      if (!isTextFixable(i.id) || seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    })
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

/** `preflight` returns tips but they are not on the snapshot; re-derive them. */
function allTips(snapshot: OriginalSnapshot): QualityIssue[] {
  return preflight({
    body: snapshot.body,
    title: snapshot.title ?? null,
    platform: snapshot.platform,
    mediaCount: snapshot.mediaCount,
  }).tips;
}

function severityRank(s: QualityIssue["severity"]): number {
  return s === "blocker" ? 3 : s === "warning" ? 2 : 1;
}

/**
 * Decides whether a model-proposed rewrite may be shown to the user.
 *
 * Note the asymmetry: a rewrite is rejected if the score drops by even one
 * point, but accepted if it merely stays equal *and* removes the cited issue.
 * The reason is that the user is being sold "this fixes X"; leaving the score
 * untouched while genuinely fixing X is a real improvement in copy quality even
 * though the heuristic score is blunt.
 */
export function judgeRewrite(original: OriginalSnapshot, candidate: CandidateRewrite): Verdict {
  const body = candidate.body?.trim() ?? "";

  if (!body) {
    return {
      accepted: false,
      reason: "empty",
      newScore: null,
      fixed: [],
      introduced: [],
      newBlockers: [],
    };
  }

  // Whitespace-only changes are noise; treat them as no-ops rather than wins.
  if (normalise(body) === normalise(original.body)) {
    return {
      accepted: false,
      reason: "unchanged",
      newScore: null,
      fixed: [],
      introduced: [],
      newBlockers: [],
    };
  }

  if (!original.issueIds.has(candidate.addresses) || !isTextFixable(candidate.addresses)) {
    return {
      accepted: false,
      reason: "unknown_issue",
      newScore: null,
      fixed: [],
      introduced: [],
      newBlockers: [],
    };
  }

  const next = snapshotDraft({
    body,
    platform: original.platform,
    title: original.title,
    mediaCount: original.mediaCount,
  });

  const fixed = [...original.issueIds].filter((id) => !next.issueIds.has(id));
  const introduced = [...next.issueIds].filter((id) => !original.issueIds.has(id));
  const newBlockers = next.blockers.map((b) => b.title);

  // Claiming to fix X while X survives is the failure mode that destroys trust.
  if (next.issueIds.has(candidate.addresses)) {
    return {
      accepted: false,
      reason: "not_addressed",
      newScore: next.score,
      fixed,
      introduced,
      newBlockers,
    };
  }

  // A rewrite that trades a warning for a blocker is a regression, full stop.
  if (newBlockers.length > original.blockers.length) {
    return {
      accepted: false,
      reason: "new_blocker",
      newScore: next.score,
      fixed,
      introduced,
      newBlockers,
    };
  }

  if (next.score < original.score) {
    return {
      accepted: false,
      reason: "score_regressed",
      newScore: next.score,
      fixed,
      introduced,
      newBlockers,
    };
  }

  return {
    accepted: true,
    reason: "ok",
    newScore: next.score,
    fixed,
    introduced,
    newBlockers: [],
  };
}

/** Comparison key for "did the text actually change", ignoring formatting. */
function normalise(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Caps how many rewrites are shown, and orders them by the severity of what they
 * fix. Three is the practical limit: beyond that the user is choosing between
 * near-identical options instead of deciding to publish.
 */
export function selectBestRewrites(
  original: OriginalSnapshot,
  candidates: CandidateRewrite[],
): Array<{ candidate: CandidateRewrite; verdict: Verdict }> {
  const scored = candidates
    .map((candidate) => ({ candidate, verdict: judgeRewrite(original, candidate) }))
    .filter((x) => x.verdict.accepted);

  // Deduplicate near-identical rewrites: the model often returns three variants
  // of the same sentence, which reads as padding.
  const seen = new Set<string>();
  const unique = scored.filter(({ candidate }) => {
    const key = normalise(candidate.body).slice(0, 160);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const severityOf = (id: string) => {
    if (original.blockers.some((b) => b.id === id)) return 3;
    if (original.warnings.some((w) => w.id === id)) return 2;
    return 1;
  };

  return unique
    .sort((a, b) => {
      const sa = severityOf(a.candidate.addresses);
      const sb = severityOf(b.candidate.addresses);
      if (sa !== sb) return sb - sa;
      return (b.verdict.newScore ?? 0) - (a.verdict.newScore ?? 0);
    })
    .slice(0, 3);
}
