/**
 * USE Brain — Evolution layer (Phases 2A–2E).
 * Server functions for: Digital Twin, Skill Map, Experiments, Decisions,
 * Due Diligence (Anti-Scam), Council of AI Advisors, Long-term Mentor.
 *
 * Council uses rule-based heuristics for now; can be swapped to Lovable AI later.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const wsInput = z.object({ workspaceId: z.string().uuid() });

/* ============================================================
 * Brain-2A — Digital Twin
 * ============================================================ */
const twinSchema = z.object({
  workspaceId: z.string().uuid(),
  work_style: z.string().max(80).optional().nullable(),
  daily_hours: z.number().min(0).max(24).optional(),
  preferred_formats: z.array(z.string().max(40)).max(20).optional(),
  avoided_formats: z.array(z.string().max(40)).max(20).optional(),
  audience_type: z.string().max(120).optional().nullable(),
  best_channel: z.string().max(40).optional().nullable(),
  pain_points: z.array(z.string().max(120)).max(20).optional(),
  strengths: z.array(z.string().max(120)).max(20).optional(),
  monetization_model: z.string().max(60).optional().nullable(),
});

export const getDigitalTwin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("digital_twins")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const upsertDigitalTwin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => twinSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { workspaceId, ...rest } = data;

    const { data: existing } = await supabase
      .from("digital_twins")
      .select("id, version")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { data: row, error } = await supabase
        .from("digital_twins")
        .update({ ...rest, version: (existing.version ?? 1) + 1, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }

    const { data: row, error } = await supabase
      .from("digital_twins")
      .insert({ workspace_id: workspaceId, user_id: userId, ...rest })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* ============================================================
 * Brain-2A — Skill Map
 * ============================================================ */
const SKILL_AREAS = [
  "copy", "content", "product", "sales", "branding",
  "analytics", "automation", "prospecting", "community", "strategy",
] as const;

export const listSkillAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("skill_assessments")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .order("assessed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertSkillAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspaceId: z.string().uuid(),
    area: z.enum(SKILL_AREAS),
    score: z.number().int().min(0).max(100),
    confidence: z.number().min(0).max(1).optional(),
    notes: z.string().max(500).optional(),
    source: z.string().max(40).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("skill_assessments")
      .insert({
        workspace_id: data.workspaceId, user_id: userId,
        area: data.area, score: data.score,
        confidence: data.confidence ?? 0.6,
        notes: data.notes, source: data.source ?? "self",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* ============================================================
 * Brain-2B — Experiments
 * ============================================================ */
export const listExperiments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("brain_experiments")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createExperiment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspaceId: z.string().uuid(),
    title: z.string().min(1).max(200),
    hypothesis: z.string().min(1).max(500),
    area: z.enum(SKILL_AREAS).optional(),
    metric_name: z.string().max(80).optional(),
    metric_baseline: z.number().optional(),
    metric_target: z.number().optional(),
    duration_days: z.number().int().min(1).max(365).optional(),
    effort_level: z.enum(["low", "medium", "high"]).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("brain_experiments")
      .insert({
        workspace_id: data.workspaceId, user_id: userId,
        title: data.title, hypothesis: data.hypothesis,
        area: data.area, metric_name: data.metric_name,
        metric_baseline: data.metric_baseline, metric_target: data.metric_target,
        duration_days: data.duration_days ?? 7,
        effort_level: data.effort_level ?? "medium",
        status: "proposed",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateExperimentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    status: z.enum(["proposed", "running", "completed", "abandoned"]),
    metric_result: z.number().optional(),
    insights: z.string().max(1000).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.status === "running") patch.starts_at = new Date().toISOString();
    if (data.status === "completed" || data.status === "abandoned") {
      patch.ends_at = new Date().toISOString();
    }
    if (data.metric_result !== undefined) patch.metric_result = data.metric_result;
    if (data.insights) patch.insights = data.insights;

    const { data: row, error } = await supabase
      .from("brain_experiments")
      .update(patch as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* ============================================================
 * Brain-2B — Assisted Decisions
 * ============================================================ */
export const listDecisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("brain_decisions")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Evaluate a proposed decision with rule-based ROI/risk heuristic. */
function evaluateDecision(input: {
  category: string;
  cost_estimate: number;
  expected_benefit: string;
}): { score: number; verdict: string; reasoning: string[] } {
  const cost = Math.max(0, input.cost_estimate);
  const reasoning: string[] = [];
  let score = 50;

  if (cost === 0) { score += 20; reasoning.push("Custo zero — risco financeiro mínimo."); }
  else if (cost < 100) { score += 10; reasoning.push("Investimento baixo, fácil de testar."); }
  else if (cost > 1000) { score -= 15; reasoning.push("Investimento alto — exige validação prévia."); }

  if (input.expected_benefit.length > 30) {
    score += 10; reasoning.push("Benefício bem articulado.");
  } else {
    score -= 10; reasoning.push("Benefício pouco específico — refine antes de executar.");
  }

  const riskyCategories = ["hire", "tool", "course", "ads"];
  if (riskyCategories.includes(input.category.toLowerCase())) {
    score -= 5; reasoning.push("Categoria com risco médio — execute em fase de teste.");
  }

  score = Math.max(0, Math.min(100, score));
  const verdict = score >= 70 ? "approve" : score >= 45 ? "test_small" : "postpone";
  return { score, verdict, reasoning };
}

export const createDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspaceId: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    category: z.string().min(1).max(60),
    cost_estimate: z.number().min(0).max(1_000_000).optional(),
    expected_benefit: z.string().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const evaluation = evaluateDecision({
      category: data.category,
      cost_estimate: data.cost_estimate ?? 0,
      expected_benefit: data.expected_benefit ?? "",
    });
    const { data: row, error } = await supabase
      .from("brain_decisions")
      .insert({
        workspace_id: data.workspaceId, user_id: userId,
        title: data.title, description: data.description,
        category: data.category,
        cost_estimate: data.cost_estimate ?? 0,
        expected_benefit: data.expected_benefit,
        status: "reviewed",
        evaluation: evaluation as unknown as Record<string, unknown>,
        reviewed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Remember as memory event
    await supabase.from("brain_memory_events").insert({
      workspace_id: data.workspaceId, user_id: userId,
      kind: "decision", subject: data.title,
      payload: { category: data.category, verdict: evaluation.verdict, score: evaluation.score },
    });

    return row;
  });

export const markDecisionExecuted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    outcome_score: z.number().int().min(0).max(100).optional(),
    outcome_note: z.string().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("brain_decisions")
      .update({
        status: "executed",
        executed_at: new Date().toISOString(),
        outcome_score: data.outcome_score,
        outcome: data.outcome_note ? { note: data.outcome_note } : {},
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* ============================================================
 * Brain-2D — Due Diligence (Anti-Scam)
 * ============================================================ */
function dueDiligenceHeuristic(input: {
  target_name: string;
  target_type: string;
  raw_input: string;
  source_url?: string;
}): { risk_score: number; verdict: string; checks: Record<string, unknown>; summary: string } {
  const text = `${input.raw_input} ${input.target_name}`.toLowerCase();
  const red = [
    "garantido", "100%", "lucro fácil", "ganhar dinheiro rápido", "sem esforço",
    "comissão alta", "mlm", "marketing multinível", "investimento garantido",
    "rendimento mensal", "duplicar capital", "criptomoeda exclusiva",
  ];
  const yellow = [
    "comissão", "afiliado", "curso premium", "vagas limitadas", "última chance",
    "bônus exclusivo", "mentoria",
  ];
  const green = [
    "cnpj", "contrato", "reembolso", "depoimentos verificáveis", "garantia",
  ];

  const redHits = red.filter((k) => text.includes(k));
  const yellowHits = yellow.filter((k) => text.includes(k));
  const greenHits = green.filter((k) => text.includes(k));

  let risk = 40;
  risk += redHits.length * 15;
  risk += yellowHits.length * 5;
  risk -= greenHits.length * 8;
  if (!input.source_url) risk += 10;
  risk = Math.max(0, Math.min(100, risk));

  const verdict = risk >= 70 ? "high_risk" : risk >= 40 ? "caution" : "low_risk";

  return {
    risk_score: risk,
    verdict,
    checks: {
      red_flags: redHits,
      yellow_flags: yellowHits,
      green_flags: greenHits,
      has_source_url: !!input.source_url,
    },
    summary: verdict === "high_risk"
      ? `${redHits.length} sinais críticos detectados. Recomendamos NÃO prosseguir sem validação externa profunda.`
      : verdict === "caution"
        ? "Sinais mistos. Pesquise reputação, peça contrato e converse com 3 ex-alunos/clientes."
        : "Sinais positivos. Ainda assim, valide reputação antes de investir valores altos.",
  };
}

export const listDueDiligenceReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("due_diligence_reports")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createDueDiligenceReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspaceId: z.string().uuid(),
    target_name: z.string().min(1).max(200),
    target_type: z.string().min(1).max(60),
    raw_input: z.string().min(10).max(5000),
    source_url: z.string().url().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const result = dueDiligenceHeuristic(data);
    const { data: row, error } = await supabase
      .from("due_diligence_reports")
      .insert({
        workspace_id: data.workspaceId, user_id: userId,
        target_name: data.target_name, target_type: data.target_type,
        raw_input: data.raw_input, source_url: data.source_url,
        risk_score: result.risk_score, verdict: result.verdict,
        checks: result.checks, summary: result.summary,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* ============================================================
 * Brain-2C — Council of AI Advisors (rule-based v1)
 * ============================================================ */
const ADVISORS = ["marketing", "financial", "operations", "growth", "branding", "legal"] as const;
type Advisor = (typeof ADVISORS)[number];

function adviseHeuristic(advisor: Advisor, topic: string): {
  summary: string; analysis: string; recommendations: string[]; confidence: number;
} {
  const t = topic.toLowerCase();
  const map: Record<Advisor, { lens: string; tips: string[] }> = {
    marketing: {
      lens: "atração de público, posicionamento, mensagem central",
      tips: [
        "Defina 1 promessa central antes de variar formato.",
        "Reduza fricção do CTA principal — quanto custa pro lead dizer sim?",
        "Audite os 3 últimos conteúdos: a mesma pessoa entenderia o que você vende?",
      ],
    },
    financial: {
      lens: "fluxo de caixa, ticket médio, margem, sustentabilidade",
      tips: [
        "Mapeie custo unitário antes de escalar oferta.",
        "Tenha 3 meses de runway antes de qualquer contratação fixa.",
        "Separe receita recorrente de pontual — só recorrente sustenta operação.",
      ],
    },
    operations: {
      lens: "tempo, processo, gargalo, repetibilidade",
      tips: [
        "Documente os 3 processos que você repete toda semana.",
        "Identifique o gargalo: capacidade, decisão, ou execução?",
        "Pense em qual tarefa custa caro fazer e barato delegar.",
      ],
    },
    growth: {
      lens: "experimentação, métrica norte, alavanca de crescimento",
      tips: [
        "Escolha 1 métrica norte para o próximo trimestre.",
        "Rode no máximo 2 experimentos simultâneos.",
        "Para cada canal, defina CAC máximo aceitável antes de testar.",
      ],
    },
    branding: {
      lens: "identidade, consistência, percepção, voz",
      tips: [
        "Sua marca é a soma de 100 toques — consistência > criatividade.",
        "Tenha 3 cores, 2 fontes, 1 voz. Mais que isso confunde.",
        "Pergunte para 5 clientes: 'em uma frase, o que somos pra você?'",
      ],
    },
    legal: {
      lens: "contratos, propriedade intelectual, responsabilidade, conformidade",
      tips: [
        "Contrato simples > acordo verbal — sempre.",
        "Não use depoimentos sem autorização escrita.",
        "Registre marca/domínio antes de campanhas grandes.",
      ],
    },
  };
  const m = map[advisor];
  return {
    summary: `Análise sob lente de ${advisor}: ${m.lens}.`,
    analysis: `Sobre "${topic}": avalio que o ponto crítico nessa lente é alinhar ${m.lens}. Sem isso, decisões adjacentes ficam frágeis.`,
    recommendations: m.tips,
    confidence: t.length > 20 ? 0.7 : 0.45,
  };
}

export const askCouncil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspaceId: z.string().uuid(),
    topic: z.string().min(5).max(500),
    advisors: z.array(z.enum(ADVISORS)).min(1).max(6).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const list = data.advisors ?? (ADVISORS as readonly Advisor[]);
    const rows = list.map((advisor) => {
      const r = adviseHeuristic(advisor, data.topic);
      return {
        workspace_id: data.workspaceId,
        advisor,
        topic: data.topic,
        summary: r.summary,
        analysis: r.analysis,
        recommendations: r.recommendations as unknown as Record<string, unknown>,
        confidence: r.confidence,
        model_used: "rule-based-v1",
      };
    });
    const { data: inserted, error } = await supabase
      .from("council_opinions")
      .insert(rows)
      .select();
    if (error) throw new Error(error.message);
    return inserted ?? [];
  });

export const listCouncilOpinions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("council_opinions")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
