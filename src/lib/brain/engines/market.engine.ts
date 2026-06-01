import type { BrainContext, EngineReport } from "../types";

/** Market Intelligence Engine — global trends + competitive radar. */
export function analyzeMarket(ctx: BrainContext): EngineReport {
  const signals: EngineReport["signals"] = [];
  const actions: EngineReport["actions"] = [];
  const opps = ctx.opportunities ?? [];
  const exploding = opps.filter((o) => o.status === "exploding").length;
  const growing = opps.filter((o) => o.status === "growing").length;

  if (exploding > 0) {
    signals.push({ engine: "market", kind: "positive", severity: "info", weight: 0.5,
      message: `${exploding} tendência(s) em explosão — janela aberta.` });
  }

  // Competitor Radar
  const comps = ctx.competitors ?? [];
  const highThreat = comps.filter((c) => c.threat === "high").length;
  const trendingUp = comps.filter((c) => c.trend === "up").length;
  if (comps.length === 0) {
    signals.push({ engine: "market", kind: "neutral", severity: "low", weight: 0.35,
      message: "Sem concorrentes mapeados — radar competitivo cego." });
    actions.push({ engine: "market", score: 60, title: "Mapear concorrentes",
      rationale: "Sem radar competitivo, oportunidades de gap ficam invisíveis.",
      href: "/app/competitors" });
  } else if (highThreat > 0) {
    signals.push({ engine: "market", kind: "negative", severity: "high", weight: 0.7,
      message: `${highThreat} concorrente(s) de alta ameaça no radar.` });
    actions.push({ engine: "market", score: 72, title: "Revisar concorrentes de alta ameaça",
      rationale: "Mapear gaps e movimentos recentes antes de definir conteúdo.",
      href: "/app/competitors" });
  }

  return {
    signals, actions,
    facts: { total: opps.length, exploding, growing,
      competitors: comps.length, highThreat, trendingUp },
  };
}
