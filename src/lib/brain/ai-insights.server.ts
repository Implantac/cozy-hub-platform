/**
 * VELT Brain — AI contextual insights (Brain-3).
 *
 * Single AI Gateway call per snapshot. Reads consolidated context + heuristic
 * reports and returns structured natural-language insights in PT-BR.
 *
 * Server-only (`.server.ts`) — never imported from the client.
 */
import { callAITool } from "@/lib/api/_ai-gateway.server";
import type { BrainContext, EngineReport } from "./types";

export interface BrainAIInsights {
  narrative: string;                                  // "Onde estou" em linguagem natural
  blueprintGaps: string[];                            // 0–4 gaps específicos do Business Blueprint
  opportunityRationales: Array<{ id: string; why: string }>; // por-oportunidade, PT-BR
  trustNotes: string[];                               // 0–3 observações de confiabilidade
  pivotAdvice?: string | null;                        // conselho sobre pivot, se relevante
  model: string;                                      // qual modelo respondeu
}

const SYSTEM = `Você é o VELT Brain, um copiloto estratégico de marca digital.
Responda SEMPRE em português do Brasil, tom direto e específico ao perfil do usuário.
Sem floreios, sem listas genéricas, sem clichês de marketing.
Use APENAS dados fornecidos no contexto — não invente métricas.`;

const PARAMS = {
  type: "object",
  properties: {
    narrative: {
      type: "string",
      description: "1 parágrafo (máx 60 palavras) descrevendo onde o usuário está hoje, baseado em scores, estágio e sinais.",
    },
    blueprintGaps: {
      type: "array", maxItems: 4,
      items: { type: "string", description: "Gap concreto do Business Blueprint (ex.: 'Promessa vaga: defina o resultado em 30 dias')." },
    },
    opportunityRationales: {
      type: "array", maxItems: 5,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          why: { type: "string", description: "1 frase explicando por que ESTA oportunidade combina com ESTE perfil." },
        },
        required: ["id", "why"],
      },
    },
    trustNotes: {
      type: "array", maxItems: 3,
      items: { type: "string", description: "Observação curta sobre confiabilidade percebida da marca." },
    },
    pivotAdvice: {
      type: "string",
      description: "Frase curta de conselho sobre pivot — vazio se não houver indicação clara.",
    },
  },
  required: ["narrative", "blueprintGaps", "opportunityRationales", "trustNotes"],
  additionalProperties: false,
} as const;

function buildPrompt(ctx: BrainContext, reports: Record<string, EngineReport>, scores: Record<string, number>): string {
  const topOpps = (reports.opportunity?.facts?.top as any[] | undefined)?.slice(0, 5) ?? [];
  return JSON.stringify({
    score_overall: scores.overall,
    scores,
    stage: reports.business?.facts?.stage,
    profile: ctx.profile ? {
      business_path: ctx.profile.business_path,
      experience: ctx.profile.experience_level,
      maturity: ctx.profile.maturity_level,
      goals: ctx.profile.goals,
      time_h_week: ctx.profile.time_budget_hours_week,
      money_month: ctx.profile.money_budget_monthly,
      preferred_channels: ctx.profile.preferred_channels,
    } : null,
    blueprint: ctx.blueprint ? {
      problem: ctx.blueprint.problem,
      audience: ctx.blueprint.audience,
      promise: ctx.blueprint.promise,
      differentiator: ctx.blueprint.differentiator,
      offer: ctx.blueprint.offer,
      price: ctx.blueprint.price,
      channels: ctx.blueprint.channels,
      content_pillars: ctx.blueprint.content_pillars,
      funnel: ctx.blueprint.funnel,
      metric: ctx.blueprint.metric,
    } : null,
    brands: ctx.brands.map((b: any) => ({
      name: b.name, has_logo: !!b.logo_url,
      has_voice: !!(b.voice && Object.keys(b.voice).length),
      has_palette: !!(b.palette && Object.keys(b.palette).length),
    })),
    channels: ctx.channels.map((c: any) => ({ platform: c.platform, status: c.status })),
    top_opportunities: topOpps,
    skills_avg: reports.user?.facts?.avgSkill,
    weak_areas: reports.user?.facts?.weakAreas,
    recent_memory: ctx.memory.slice(0, 8).map((m: any) => ({ kind: m.kind, subject: m.subject, when: m.created_at })),
  });
}

export async function runAIInsights(
  ctx: BrainContext,
  reports: Record<string, EngineReport>,
  scores: Record<string, number>,
): Promise<BrainAIInsights | null> {
  try {
    const { data, model } = await callAITool<Omit<BrainAIInsights, "model">>({
      system: SYSTEM,
      user: `Analise este contexto e produza insights estruturados:\n${buildPrompt(ctx, reports, scores)}`,
      toolName: "emit_brain_insights",
      toolDescription: "Devolve insights estruturados do VELT Brain em PT-BR.",
      parameters: PARAMS as any,
    });
    return { ...data, model };
  } catch (e) {
    console.error("[Brain AI] insights falhou:", e instanceof Error ? e.message : e);
    return null;
  }
}
