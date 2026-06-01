import type { BrainContext, EngineReport } from "../types";

/** Market Intelligence Engine — global trends snapshot. */
export function analyzeMarket(ctx: BrainContext): EngineReport {
  const signals: EngineReport["signals"] = [];
  const opps = ctx.opportunities ?? [];
  const exploding = opps.filter((o) => o.status === "exploding").length;
  const growing = opps.filter((o) => o.status === "growing").length;

  if (exploding > 0) {
    signals.push({ engine: "market", kind: "positive", severity: "info", weight: 0.5,
      message: `${exploding} tendência(s) em explosão — janela aberta.` });
  }

  return {
    signals, actions: [],
    facts: { total: opps.length, exploding, growing },
  };
}
