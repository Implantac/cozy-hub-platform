/**
 * VELT — Decision OS (Phase 1)
 * Server functions for: Business Validator + Reality Check.
 * Both use Lovable AI Gateway with structured tool calling.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAITool } from "./_ai-gateway.server";
import { throwIfError } from "./_supabase";

const wsInput = z.object({ workspaceId: z.string().uuid() });

/* ============================================================
 * Business Validator
 * ============================================================ */
const validateInput = z.object({
  workspaceId: z.string().uuid(),
  idea: z.string().min(20).max(2000),
  business_model: z.string().max(200).optional(),
  target_audience: z.string().max(300).optional(),
});

interface ValidatorOutput {
  market_demand_score: number;
  competition_score: number;
  complexity_score: number;
  opportunity_score: number;
  verdict: "strong" | "promising" | "challenging" | "weak";
  strengths: string[];
  risks: string[];
  next_steps: string[];
  summary: string;
}

export const validateBusinessIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => validateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: twin } = await supabase
      .from("digital_twins")
      .select("work_style, daily_hours, monetization_model, audience_type, strengths, pain_points")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    const twinCtx = twin
      ? `Perfil do empreendedor: estilo=${twin.work_style ?? "?"}, horas/dia=${twin.daily_hours ?? "?"}, audiência=${twin.audience_type ?? "?"}, modelo preferido=${twin.monetization_model ?? "?"}, forças=${(twin.strengths ?? []).join(", ")}, dores=${(twin.pain_points ?? []).join(", ")}.`
      : "Perfil do empreendedor não preenchido.";

    const system = `Você é um validador de ideias de negócio digital. Analise sob 4 dimensões: demanda de mercado, concorrência, complexidade de execução, oportunidade total. Seja honesto e direto — sem clichês motivacionais. Responda em português do Brasil.`;
    const user = `${twinCtx}\n\nIdeia: "${data.idea}"\nModelo de negócio: ${data.business_model ?? "não especificado"}\nPúblico-alvo: ${data.target_audience ?? "não especificado"}\n\nValide a ideia.`;

    const { data: ai, model } = await callAITool<ValidatorOutput>({
      system,
      user,
      toolName: "validate_idea",
      toolDescription: "Estrutura da validação de ideia de negócio.",
      parameters: {
        type: "object",
        properties: {
          market_demand_score: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Score de demanda de mercado (0-100).",
          },
          competition_score: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Intensidade da concorrência (0=zero, 100=saturado).",
          },
          complexity_score: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Complexidade de execução (0=simples, 100=muito complexo).",
          },
          opportunity_score: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Score geral de oportunidade.",
          },
          verdict: { type: "string", enum: ["strong", "promising", "challenging", "weak"] },
          strengths: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
          risks: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
          next_steps: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 5,
            description: "Próximas ações concretas.",
          },
          summary: { type: "string", description: "1-2 frases com diagnóstico central." },
        },
        required: [
          "market_demand_score",
          "competition_score",
          "complexity_score",
          "opportunity_score",
          "verdict",
          "strengths",
          "risks",
          "next_steps",
          "summary",
        ],
        additionalProperties: false,
      },
    });

    const { data: row, error } = await supabase
      .from("business_validations")
      .insert({
        workspace_id: data.workspaceId,
        user_id: userId,
        idea: data.idea,
        business_model: data.business_model ?? null,
        target_audience: data.target_audience ?? null,
        market_demand_score: ai.market_demand_score,
        competition_score: ai.competition_score,
        complexity_score: ai.complexity_score,
        opportunity_score: ai.opportunity_score,
        verdict: ai.verdict,
        strengths: ai.strengths as never,
        risks: ai.risks as never,
        next_steps: ai.next_steps as never,
        ai_analysis: { summary: ai.summary } as never,
        model_used: model,
      })
      .select()
      .single();

    throwIfError(error);
    return row;
  });

export const listBusinessValidations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("business_validations")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);
    throwIfError(error);
    return rows ?? [];
  });

/* ============================================================
 * Reality Check Engine
 * ============================================================ */
/** The change types the reality check accepts. Single source for validator and UI. */
export const REALITY_CHANGE_TYPES = [
  "pivot",
  "new_channel",
  "new_offer",
  "scale_up",
  "stop",
  "investment",
] as const;

export type RealityChangeType = (typeof REALITY_CHANGE_TYPES)[number];

const realityInput = z.object({
  workspaceId: z.string().uuid(),
  change_type: z.enum(REALITY_CHANGE_TYPES),
  current_state: z.string().min(20).max(2000),
  proposed_change: z.string().min(20).max(2000),
});

interface RealityOutput {
  caution_level: "green" | "yellow" | "red";
  indicators_positive: string[];
  indicators_warning: string[];
  recommendations: string[];
  questions_to_answer: string[];
  summary: string;
}

export const runRealityCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => realityInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: twin } = await supabase
      .from("digital_twins")
      .select("work_style, daily_hours, monetization_model, strengths, pain_points")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: recentDecisions } = await supabase
      .from("brain_decisions")
      .select("title, category, status, outcome_score")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(5);

    const twinCtx = twin
      ? `Perfil: estilo=${twin.work_style ?? "?"}, horas/dia=${twin.daily_hours ?? "?"}, modelo=${twin.monetization_model ?? "?"}, forças=${(twin.strengths ?? []).join(", ")}.`
      : "Perfil não preenchido.";
    const historyCtx =
      (recentDecisions ?? []).length > 0
        ? `Decisões recentes: ${(recentDecisions ?? []).map((d: { title: string; status: string }) => `${d.title} (${d.status})`).join("; ")}.`
        : "Sem histórico de decisões registrado.";

    const system = `Você é um conselheiro experiente que evita que empreendedores tomem decisões impulsivas. Faça um "reality check" honesto: identifique se a mudança é prematura, bem fundamentada ou arriscada. Use semáforo: verde (siga), amarelo (cuidado), vermelho (não recomendo agora). Responda em português do Brasil, sem clichês.`;
    const user = `${twinCtx}\n${historyCtx}\n\nTipo de mudança: ${data.change_type}\nEstado atual: "${data.current_state}"\nMudança proposta: "${data.proposed_change}"\n\nFaça o reality check.`;

    const { data: ai, model } = await callAITool<RealityOutput>({
      system,
      user,
      toolName: "reality_check",
      toolDescription: "Avaliação honesta de uma mudança/pivô proposto.",
      parameters: {
        type: "object",
        properties: {
          caution_level: {
            type: "string",
            enum: ["green", "yellow", "red"],
            description: "verde=siga, amarelo=cuidado, vermelho=pare.",
          },
          indicators_positive: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 5,
            description: "Sinais que justificam a mudança.",
          },
          indicators_warning: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 5,
            description: "Sinais de alerta a considerar.",
          },
          recommendations: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 5,
            description: "Recomendações concretas.",
          },
          questions_to_answer: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 5,
            description: "Perguntas a responder antes de decidir.",
          },
          summary: { type: "string", description: "1-2 frases com veredito honesto." },
        },
        required: [
          "caution_level",
          "indicators_positive",
          "indicators_warning",
          "recommendations",
          "questions_to_answer",
          "summary",
        ],
        additionalProperties: false,
      },
    });

    const { data: row, error } = await supabase
      .from("reality_checks")
      .insert({
        workspace_id: data.workspaceId,
        user_id: userId,
        change_type: data.change_type,
        current_state: data.current_state,
        proposed_change: data.proposed_change,
        caution_level: ai.caution_level,
        indicators_positive: ai.indicators_positive as never,
        indicators_warning: ai.indicators_warning as never,
        recommendations: ai.recommendations as never,
        questions_to_answer: ai.questions_to_answer as never,
        summary: ai.summary,
        ai_analysis: {} as never,
        model_used: model,
      })
      .select()
      .single();

    throwIfError(error);
    return row;
  });

export const listRealityChecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("reality_checks")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);
    throwIfError(error);
    return rows ?? [];
  });
