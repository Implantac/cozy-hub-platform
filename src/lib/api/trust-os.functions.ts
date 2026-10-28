/**
 * VELT — Trust OS (Phase 2)
 * Trust Analyzer: analyzes IG/YT/sites/courses/suppliers for risk signals.
 * Before You Buy: structured pre-purchase workflow with AI-driven sections.
 * Both persist to `due_diligence_reports` (extending `checks` JSON).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAITool } from "./_ai-gateway.server";
import { throwIfError } from "./_supabase";
import { parseCnpj, parseDomain } from "@/lib/trust/signals";

/* ============================================================
 * Trust Analyzer
 * ============================================================ */
const TARGET_TYPES = [
  "instagram",
  "youtube",
  "tiktok",
  "website",
  "course",
  "supplier",
  "person",
  "other",
] as const;

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
          trust_signals: {
            type: "array",
            items: { type: "string" },
            description: "Sinais positivos concretos",
          },
          red_flags: {
            type: "array",
            items: { type: "string" },
            description: "Sinais de alerta concretos",
          },
          questions_to_ask: {
            type: "array",
            items: { type: "string" },
            description: "Perguntas que o usuário deve fazer antes de avançar",
          },
          recommendation: { type: "string", description: "Recomendação direta de 1-2 frases" },
          summary: { type: "string", description: "Resumo executivo em 2-3 frases" },
        },
        required: [
          "risk_score",
          "verdict",
          "trust_signals",
          "red_flags",
          "questions_to_ask",
          "recommendation",
          "summary",
        ],
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
          comparison_alternatives: {
            type: "array",
            items: { type: "string" },
            description: "Alternativas no mercado (grátis ou pagas)",
          },
          questions_for_seller: { type: "array", items: { type: "string" } },
          red_flags: { type: "array", items: { type: "string" } },
          green_flags: { type: "array", items: { type: "string" } },
          final_recommendation: { type: "string" },
          summary: { type: "string" },
        },
        required: [
          "risk_score",
          "verdict",
          "value_for_money",
          "promise_realism",
          "hidden_costs",
          "comparison_alternatives",
          "questions_for_seller",
          "red_flags",
          "green_flags",
          "final_recommendation",
          "summary",
        ],
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

/* ============================================================
 * Registry-backed dossier (item 5 of the roadmap)
 * ============================================================ */

/**
 * Replaces free-text → risk-score with facts → evidence → score.
 *
 * The previous analyzer asked a model to rate a target from the user's own
 * description of it. It could only return what the user already believed. This
 * one reads two public registries and derives the score from what they say,
 * attaching the evidence to every signal so the user can re-run the check.
 */
export const runRegistryDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        cnpj: z.string().max(30).optional(),
        site: z.string().max(300).optional(),
        label: z.string().max(200).optional(),
        /** The user's own notes stay, but they no longer drive the score. */
        observations: z.string().max(4000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const cnpj = data.cnpj ? parseCnpj(data.cnpj) : null;
    const domain = data.site ? parseDomain(data.site) : null;

    if ((!cnpj || !cnpj.ok) && (!domain || !domain.ok)) {
      // Nothing verifiable was supplied. Refusing is more useful than guessing:
      // a "risk score" produced from nothing is worse than no score at all.
      return {
        ok: false as const,
        rejected: true as const,
        reason:
          cnpj && !cnpj.ok
            ? cnpjMessage(cnpj.reason)
            : domain && !domain.ok
              ? domainMessage(domain.reason)
              : "Informe um CNPJ válido ou o site do negócio.",
      };
    }

    const { buildDossier } = await import("@/lib/trust/dossier.server");
    const dossier = await buildDossier({
      cnpjDigits: cnpj?.ok ? cnpj.digits : null,
      domainHost: domain?.ok ? domain.host : null,
      cnpjInvalid: cnpj && !cnpj.ok ? cnpj.reason : null,
      domainInvalid: domain && !domain.ok ? domain.reason : null,
    });

    const targetName =
      data.label?.trim() ||
      dossier.company?.nomeFantasia ||
      dossier.company?.razaoSocial ||
      dossier.domain?.host ||
      "Alvo sem nome";

    // risk_score in this table means "higher = more risk" (legacy contract).
    // The dossier produces confidence (higher = better), so invert on write and
    // keep both numbers in the payload to avoid the classic sign confusion.
    const riskScore = Math.max(0, Math.min(100, 100 - dossier.verdict.score));

    const verdictMap = {
      high: "safe",
      moderate: "caution",
      low: "risky",
      insufficient: "caution",
    } as const;

    const { data: row, error } = await supabase
      .from("due_diligence_reports")
      .insert({
        workspace_id: data.workspaceId,
        user_id: userId,
        target_name: targetName,
        target_type: "registry_dossier",
        raw_input: data.observations ?? null,
        source_url: dossier.domain ? `https://${dossier.domain.host}` : null,
        risk_score: riskScore,
        verdict:
          dossier.verdict.level === "insufficient"
            ? "insufficient"
            : verdictMap[dossier.verdict.level],
        checks: {
          mode: "registry_dossier",
          confidence: dossier.verdict.score,
          level: dossier.verdict.level,
          headline: dossier.verdict.headline,
          signals: dossier.verdict.signals,
          sources: dossier.sources,
          fetchedAt: dossier.fetchedAt,
          company: dossier.company,
          domain: dossier.domain,
        } as never,
        summary: dossier.verdict.headline,
      })
      .select()
      .single();
    throwIfError(error);

    return { ok: true as const, dossier, report: row };
  });

function cnpjMessage(reason: "empty" | "length" | "repeated" | "checksum"): string {
  switch (reason) {
    case "length":
      return "CNPJ precisa ter 14 dígitos.";
    case "repeated":
      return "Este número não é um CNPJ válido.";
    case "checksum":
      return "Os dígitos verificadores do CNPJ não fecham — provavelmente há um erro de digitação.";
    default:
      return "Informe o CNPJ.";
  }
}

function domainMessage(reason: "empty" | "invalid" | "ip" | "free_host"): string {
  switch (reason) {
    case "ip":
      return "Endereço IP não tem registro público para consultar. Use o domínio do site.";
    case "free_host":
      return "Site hospedado em plataforma gratuita (Wix, Linktree, Netlify…) não tem registro próprio para verificar. Tente o CNPJ.";
    case "invalid":
      return "Endereço de site inválido.";
    default:
      return "Informe o site.";
  }
}
