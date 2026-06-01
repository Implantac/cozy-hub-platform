import type { BrainContext, EngineReport } from "../types";

/** Growth Intelligence Engine — detects consistency drops and stagnation. */
export function analyzeGrowth(ctx: BrainContext): EngineReport {
  const signals: EngineReport["signals"] = [];
  const actions: EngineReport["actions"] = [];
  const content = ctx.content ?? [];
  const jobs = ctx.jobs ?? [];

  const now = Date.now();
  const d7 = now - 7 * 86400_000;
  const d30 = now - 30 * 86400_000;

  const recent7 = content.filter((c) => new Date(c.created_at).getTime() > d7).length;
  const recent30 = content.filter((c) => new Date(c.created_at).getTime() > d30).length;

  const succ = jobs.filter((j) => j.status === "succeeded").length;
  const failed = jobs.filter((j) => j.status === "dead_letter" || j.status === "failed").length;
  const successRate = jobs.length ? succ / jobs.length : 0;

  if (recent7 === 0 && content.length > 0) {
    signals.push({ engine: "growth", kind: "negative", severity: "high", weight: 0.85,
      message: "Sem publicações nos últimos 7 dias — consistência caiu." });
    actions.push({ engine: "growth", score: 90, title: "Voltar a publicar esta semana",
      rationale: "Consistência é o maior fator de crescimento orgânico.",
      href: "/app/content" });
  } else if (recent30 < 8) {
    signals.push({ engine: "growth", kind: "negative", severity: "medium", weight: 0.55,
      message: `Apenas ${recent30} publicações em 30 dias (meta: 8+).` });
  } else {
    signals.push({ engine: "growth", kind: "positive", severity: "info", weight: 0.4,
      message: `Boa cadência: ${recent30} publicações nos últimos 30 dias.` });
  }

  if (failed > 0 && jobs.length > 0 && successRate < 0.7) {
    signals.push({ engine: "growth", kind: "negative", severity: "medium", weight: 0.6,
      message: `Taxa de publicação ${Math.round(successRate * 100)}% — investigar falhas.` });
  }

  return {
    signals, actions,
    facts: { recent7, recent30, successRate, total: content.length },
  };
}
