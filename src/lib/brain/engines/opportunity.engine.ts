import type { BrainContext, EngineReport } from "../types";

/**
 * Opportunity Intelligence Engine — ranks opportunities by compatibility with the user profile.
 * This is the differentiator vs a generic trends list.
 */
export function analyzeOpportunity(ctx: BrainContext): EngineReport {
  const signals: EngineReport["signals"] = [];
  const actions: EngineReport["actions"] = [];

  const profile = ctx.profile;
  const opps = ctx.opportunities ?? [];

  const userTags: string[] = [
    ...(profile?.preferred_channels ?? []),
    ...(profile?.content_preferences ?? []),
    ...(profile?.goals ?? []),
    profile?.business_path,
  ]
    .filter(Boolean)
    .map((s: string) => String(s).toLowerCase());

  const difficultyPenalty: Record<string, number> = { low: 0, medium: 10, high: 25 };
  const userTolerance =
    profile?.experience_level === "advanced"
      ? 30
      : profile?.experience_level === "intermediate"
        ? 15
        : 0;

  const ranked = opps
    .map((o) => {
      let score = 50;
      if (o.status === "exploding") score += 25;
      else if (o.status === "growing") score += 15;
      else if (o.status === "saturated") score -= 15;
      else if (o.status === "declining") score -= 30;

      if (o.growth_potential === "high") score += 15;
      if (o.competition === "low") score += 10;
      if (o.competition === "high") score -= 10;

      score -= Math.max(0, (difficultyPenalty[o.difficulty] ?? 10) - userTolerance);

      const tags: string[] = (o.tags ?? []).map((t: string) => t.toLowerCase());
      const tagOverlap = tags.filter((t) => userTags.includes(t)).length;
      score += tagOverlap * 8;

      return { ...o, _compatibility: Math.max(0, Math.min(100, score)) };
    })
    .sort((a, b) => b._compatibility - a._compatibility);

  const top = ranked.slice(0, 5);

  if (top.length > 0 && top[0]._compatibility >= 70) {
    signals.push({
      engine: "opportunity",
      kind: "positive",
      severity: "info",
      weight: 0.5,
      message: `Oportunidade alinhada: ${top[0].title} (${top[0]._compatibility}% match).`,
    });
    actions.push({
      engine: "opportunity",
      score: 75,
      title: `Avaliar: ${top[0].title}`,
      rationale: top[0].description ?? "Alto match com seu perfil.",
      href: "/app/opportunities",
    });
  }

  return {
    signals,
    actions,
    facts: {
      top: top.map((o) => ({
        id: o.id,
        title: o.title,
        match: o._compatibility,
        status: o.status,
      })),
    },
  };
}
