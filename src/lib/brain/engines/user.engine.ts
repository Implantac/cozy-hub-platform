import type { BrainContext, EngineReport } from "../types";

/** User Intelligence Engine — understands the user's cognitive profile. */
export function analyzeUser(ctx: BrainContext): EngineReport {
  const p = ctx.profile;
  const signals: EngineReport["signals"] = [];
  const actions: EngineReport["actions"] = [];

  if (!p) {
    signals.push({
      engine: "user", kind: "negative", severity: "high", weight: 0.9,
      message: "Perfil digital não preenchido — o cérebro não consegue personalizar.",
    });
    actions.push({
      engine: "user", score: 95, title: "Complete o Digital Navigator",
      rationale: "Sem perfil não dá para filtrar oportunidades nem priorizar canais.",
      href: "/app/navigator",
    });
    return { signals, actions, facts: { hasProfile: false } };
  }

  const complexity =
    p.experience_level === "beginner" ? "low"
    : p.experience_level === "intermediate" ? "medium" : "high";

  const time = p.time_budget_hours_week ?? 0;
  const money = Number(p.money_budget_monthly ?? 0);

  if (time < 3) {
    signals.push({
      engine: "user", kind: "negative", severity: "medium", weight: 0.6,
      message: `Apenas ${time}h/semana — recomendações longas serão evitadas.`,
    });
  }
  if (p.experience_level === "beginner" && money < 100) {
    signals.push({
      engine: "user", kind: "neutral", severity: "info", weight: 0.3,
      message: "Estratégias orgânicas terão prioridade sobre tráfego pago.",
    });
  }

  return {
    signals, actions,
    facts: {
      hasProfile: true,
      complexity,
      time,
      money,
      maturity: p.maturity_level,
      path: p.business_path,
      goals: p.goals ?? [],
      preferredChannels: p.preferred_channels ?? [],
    },
  };
}
