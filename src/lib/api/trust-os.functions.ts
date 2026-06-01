/**
 * USE OS — Trust OS (Phase 2)
 * Trust Analyzer: analyzes IG/YT/sites/courses/suppliers for risk signals.
 * Before You Buy: structured pre-purchase workflow with AI-driven sections.
 * Both persist to `due_diligence_reports` (extending `checks` JSON).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAITool } from "./_ai-gateway.server";
import { throwIfError } from "./_supabase";

/* ============================================================
 * Trust Analyzer
 * ============================================================ */
const TARGET_TYPES = ["instagram", "youtube", "tiktok", "website", "course", "supplier", "person", "other"] as const;

const trustInput = z.object({
  workspaceId: z.string().uuid(),
  target_name: z.string().min(2).max(200),
  target_type: z.enum(TARGET_TYPES),
  source_url: z.string().url().max(500).optional(),
  observations: z.string().min(20).max(4000),
});

interface TrustAnalyzerOutput {
  risk_score: number; // 0-100, higher = more risk
  verdict: "safe" | "caution" | "risky" | "avoid";
  trust_signals: string[];
  red_flags: string[];
  questions_to_ask: string[];
  recommendation: string;
  summary: string;
}

export const runTrustAnalyzer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => trustInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const system = `Você é um analista de confiança digital especializado em detectar golpes, esquemas de pirâmide, gurus duvidosos, cursos vazios e fornecedores não confiáveis no mercado digital brasileiro. Seja crítico, direto, sem clichês. Avalie sinais reais. Score de risco: 0-20 seguro, 21-50 atenção, 51-75 arriscado, 76-100 evitar.`;

    const user = `Analise o alvo abaixo:
Tipo: ${data.target_type}
Nome: ${data.target_name}
URL: ${data.source_url ?? "n/d"}

Observações do usuário:
${data.observations}

Produza análise de confiança estruturada.`;

    const { data: result } = await callAITool<TrustAnalyzerOutput>({
      system,
      user,
      toolName: "emit_trust_analysis",
      toolDescription: "Emite análise estruturada de confiança/risco do alvo digital.",
      parameters: {
        type: "object",
        properties: {
          risk_score: { type: "number", description: "0-100, maior = mais risco" },
          verdict: { type: "string", enum: ["safe", "caution", "risky", "avoid"] },
          trust_signals: { type: "array", items: { type: "string" }, description: "Sinais positivos concretos" },
          red_flags: { type: "array", items: { type: "string" }, description: "Sinais de alerta concretos" },
          questions_to_ask: { type: "array", items: { type: "string" }, description: "Perguntas que o usuário deve fazer antes de avançar" },
          recommendation: { type: "string", description: "Recomendação direta de 1-2 frases" },
          summary: { type: "string", description: "Resumo executivo em 2-3 frases" },
        },
        required: ["risk_score", "verdict", "trust_signals", "red_flags", "questions_to_ask", "recommendation", "summary"],
      },
    });

    const { data: row, error } = await supabase
      .from("due_diligence_reports")
      .insert({
        workspace_id: data.workspaceId,
        user_id: userId,
        target_name: data.target_name,
        target_type: `trust:${data.target_type}`,
        raw_input: data.observations,
        source_url: data.source_url,
        risk_score: result.risk_score,
        verdict: result.verdict,
        checks: {
          mode: "trust_analyzer",
          trust_signals: result.trust_signals,
          red_flags: result.red_flags,
          questions_to_ask: result.questions_to_ask,
          recommendation: result.recommendation,
        } as never,
        summary: result.summary,
      })
      .select()
      .single();
    throwIfError(error);
    return row;
  });

/* ============================================================
 * Before You Buy
 * ============================================================ */
const beforeBuyInput = z.object({
  workspaceId: z.string().uuid(),
  product_name: z.string().min(2).max(200),
  seller: z.string().min(2).max(200),
  price_brl: z.number().min(0).max(1_000_000),
  promise: z.string().min(20).max(2000),
  source_url: z.string().url().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

interface BeforeYouBuyOutput {
  risk_score: number;
  verdict: "buy" | "negotiate" | "wait" | "skip";
  value_for_money: number; // 0-100
  promise_realism: number; // 0-100
  hidden_costs: string[];
  comparison_alternatives: string[];
  questions_for_seller: string[];
  red_flags: string[];
  green_flags: string[];
  final_recommendation: string;
  summary: string;
}

export const runBeforeYouBuy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => beforeBuyInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const system = `Você é um consultor de compras digitais imparcial. Avalia produtos, cursos, mentorias, ferramentas e serviços do mercado digital brasileiro. Detecta promessas exageradas, custos escondidos, alternativas melhores. Seja honesto, sem viés, mostre tradeoffs reais.`;

    const user = `Avalie esta compra ANTES de o usuário fechar:
Produto/Serviço: ${data.product_name}
Vendedor: ${data.seller}
Preço: R$ ${data.price_brl.toLocaleString("pt-BR")}
URL: ${data.source_url ?? "n/d"}

Promessa principal do vendedor:
${data.promise}

Notas do usuário: ${data.notes ?? "n/d"}

Produza avaliação estruturada "antes de comprar".`;

    const { data: result } = await callAITool<BeforeYouBuyOutput>({
      system,
      user,
      toolName: "emit_before_you_buy",
      toolDescription: "Emite avaliação estruturada pré-compra.",
      parameters: {
        type: "object",
        properties: {
          risk_score: { type: "number", description: "0-100" },
          verdict: { type: "string", enum: ["buy", "negotiate", "wait", "skip"] },
          value_for_money: { type: "number", description: "0-100" },
          promise_realism: { type: "number", description: "0-100, quão realista é a promessa" },
          hidden_costs: { type: "array", items: { type: "string" } },
          comparison_alternatives: { type: "array", items: { type: "string" }, description: "Alternativas no mercado (grátis ou pagas)" },
          questions_for_seller: { type: "array", items: { type: "string" } },
          red_flags: { type: "array", items: { type: "string" } },
          green_flags: { type: "array", items: { type: "string" } },
          final_recommendation: { type: "string" },
          summary: { type: "string" },
        },
        required: ["risk_score", "verdict", "value_for_money", "promise_realism", "hidden_costs", "comparison_alternatives", "questions_for_seller", "red_flags", "green_flags", "final_recommendation", "summary"],
      },
    });

    const { data: row, error } = await supabase
      .from("due_diligence_reports")
      .insert({
        workspace_id: data.workspaceId,
        user_id: userId,
        target_name: data.product_name,
        target_type: "before_you_buy",
        raw_input: data.promise,
        source_url: data.source_url,
        risk_score: result.risk_score,
        verdict: result.verdict,
        checks: {
          mode: "before_you_buy",
          seller: data.seller,
          price_brl: data.price_brl,
          value_for_money: result.value_for_money,
          promise_realism: result.promise_realism,
          hidden_costs: result.hidden_costs,
          comparison_alternatives: result.comparison_alternatives,
          questions_for_seller: result.questions_for_seller,
          red_flags: result.red_flags,
          green_flags: result.green_flags,
          final_recommendation: result.final_recommendation,
        } as never,
        summary: result.summary,
      })
      .select()
      .single();
    throwIfError(error);
    return row;
  });

/* ============================================================
 * History
 * ============================================================ */
export const listTrustReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ workspaceId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("due_diligence_reports")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);
    throwIfError(error);
    return rows ?? [];
  });
