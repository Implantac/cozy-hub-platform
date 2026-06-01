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
        status: "evaluated",
        evaluation: evaluation as never,
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
        checks: result.checks as never, summary: result.summary,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* ============================================================
 * Brain-2C — Council of AI Advisors (rule-based v1)
 * ============================================================ */
const ADVISORS = ["marketing", "financial", "strategy", "content", "business"] as const;
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
    strategy: {
      lens: "direção, alavanca de longo prazo, foco vs. dispersão",
      tips: [
        "Escolha 1 métrica norte para o próximo trimestre.",
        "Diga não para 5 oportunidades antes de dizer sim para 1.",
        "Defina onde NÃO competir — clareza estratégica é subtração.",
      ],
    },
    content: {
      lens: "narrativa, formato, cadência, ressonância com a audiência",
      tips: [
        "Encontre 3 dores reais e crie 1 conteúdo por dor — não invente temas.",
        "Reuse seu melhor post em 3 formatos antes de criar algo novo.",
        "Consistência semanal vale mais que rajadas geniais esporádicas.",
      ],
    },
    business: {
      lens: "modelo, operação, repetibilidade, escalabilidade",
      tips: [
        "Documente os 3 processos que você repete toda semana.",
        "Identifique o gargalo: capacidade, decisão, ou execução?",
        "Antes de escalar, valide que 10 clientes querem comprar de novo.",
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
        recommendations: r.recommendations as never,
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

/* ============================================================
 * Brain-2E — Long-term Mentor (Timeline)
 * Aggregates brain_memory_events + brain_snapshots by quarter
 * to build a narrative of progress, patterns, and lessons.
 * ============================================================ */
type TimelinePeriod = {
  key: string; // e.g. "2026-Q2"
  year: number;
  quarter: number;
  starts_at: string;
  ends_at: string;
  events_count: number;
  decisions_count: number;
  experiments_count: number;
  wins: string[];
  setbacks: string[];
  score_avg: number | null;
  highlights: string[];
  narrative: string;
};

function quarterOf(d: Date): { year: number; q: number; key: string } {
  const y = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return { year: y, q, key: `${y}-Q${q}` };
}

export const getLongTermTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const ws = data.workspaceId;

    const [eventsRes, decisionsRes, experimentsRes, snapshotsRes] = await Promise.all([
      supabase.from("brain_memory_events").select("*").eq("workspace_id", ws).order("created_at", { ascending: true }).limit(1000),
      supabase.from("brain_decisions").select("*").eq("workspace_id", ws).order("created_at", { ascending: true }).limit(500),
      supabase.from("brain_experiments").select("*").eq("workspace_id", ws).order("created_at", { ascending: true }).limit(500),
      supabase.from("brain_snapshots").select("*").eq("workspace_id", ws).order("computed_at", { ascending: true }).limit(500),
    ]);

    const events = eventsRes.data ?? [];
    const decisions = decisionsRes.data ?? [];
    const experiments = experimentsRes.data ?? [];
    const snapshots = snapshotsRes.data ?? [];

    const buckets = new Map<string, TimelinePeriod>();
    const bucket = (dateStr: string) => {
      const d = new Date(dateStr);
      const { year, q, key } = quarterOf(d);
      let b = buckets.get(key);
      if (!b) {
        const starts = new Date(Date.UTC(year, (q - 1) * 3, 1));
        const ends = new Date(Date.UTC(year, q * 3, 0, 23, 59, 59));
        b = {
          key, year, quarter: q,
          starts_at: starts.toISOString(), ends_at: ends.toISOString(),
          events_count: 0, decisions_count: 0, experiments_count: 0,
          wins: [], setbacks: [], score_avg: null,
          highlights: [], narrative: "",
        };
        buckets.set(key, b);
      }
      return b;
    };

    for (const e of events) {
      const b = bucket(e.created_at);
      b.events_count++;
      if (e.sentiment === "positive" && b.wins.length < 5) b.wins.push(e.subject);
      if (e.sentiment === "negative" && b.setbacks.length < 5) b.setbacks.push(e.subject);
    }
    for (const d of decisions) {
      const b = bucket(d.created_at);
      b.decisions_count++;
      if ((d.outcome_score ?? 0) >= 70 && b.wins.length < 5) b.wins.push(`Decisão: ${d.title}`);
      if ((d.outcome_score ?? 100) < 30 && b.setbacks.length < 5) b.setbacks.push(`Decisão: ${d.title}`);
    }
    for (const x of experiments) {
      const b = bucket(x.created_at);
      b.experiments_count++;
      if (x.status === "completed" && x.metric_result != null && x.metric_target != null && Number(x.metric_result) >= Number(x.metric_target) && b.wins.length < 5) {
        b.wins.push(`Experimento: ${x.title}`);
      }
    }
    const scoresByBucket = new Map<string, number[]>();
    for (const s of snapshots) {
      const b = bucket(s.computed_at);
      const scores = (s.scores ?? {}) as Record<string, number>;
      const vals = Object.values(scores).filter((v) => typeof v === "number");
      if (vals.length) {
        const avg = vals.reduce((a, c) => a + c, 0) / vals.length;
        const arr = scoresByBucket.get(b.key) ?? [];
        arr.push(avg);
        scoresByBucket.set(b.key, arr);
      }
    }
    for (const [key, arr] of scoresByBucket.entries()) {
      const b = buckets.get(key);
      if (b) b.score_avg = arr.reduce((a, c) => a + c, 0) / arr.length;
    }

    const list = Array.from(buckets.values()).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const prev = i > 0 ? list[i - 1] : null;
      const delta = prev && prev.score_avg != null && b.score_avg != null ? b.score_avg - prev.score_avg : null;
      const dir = delta == null ? "estável" : delta > 5 ? "evolução clara" : delta < -5 ? "retração" : "platô";
      const parts: string[] = [];
      parts.push(`${b.key}: ${b.events_count} eventos, ${b.decisions_count} decisões, ${b.experiments_count} experimentos.`);
      if (b.score_avg != null) parts.push(`Score médio ${b.score_avg.toFixed(1)} (${dir}).`);
      if (b.wins.length) parts.push(`Vitórias: ${b.wins.slice(0, 3).join("; ")}.`);
      if (b.setbacks.length) parts.push(`Tropeços: ${b.setbacks.slice(0, 3).join("; ")}.`);
      if (!b.wins.length && !b.setbacks.length && b.events_count === 0) parts.push("Período silencioso — pouca atividade registrada.");
      b.narrative = parts.join(" ");
      if (b.wins.length >= 3) b.highlights.push("Trimestre de alta execução");
      if (b.setbacks.length >= 3) b.highlights.push("Trimestre de fricção");
      if (delta != null && delta > 10) b.highlights.push("Salto de maturidade");
      if (delta != null && delta < -10) b.highlights.push("Alerta: regressão");
    }

    // Overall mentor synthesis
    const totalEvents = events.length;
    const totalDecisions = decisions.length;
    const completedExp = experiments.filter((x) => x.status === "completed").length;
    const firstScore = list.find((b) => b.score_avg != null)?.score_avg ?? null;
    const lastScore = [...list].reverse().find((b) => b.score_avg != null)?.score_avg ?? null;
    const trajectory = firstScore != null && lastScore != null ? lastScore - firstScore : null;

    const mentorSummary = {
      periods_tracked: list.length,
      total_events: totalEvents,
      total_decisions: totalDecisions,
      completed_experiments: completedExp,
      trajectory_delta: trajectory,
      verdict: trajectory == null
        ? "Ainda não tenho histórico suficiente para julgar trajetória — siga registrando."
        : trajectory > 10
          ? "Trajetória ascendente. Você está construindo composto — mantenha o ritmo e documente o que funciona."
          : trajectory < -10
            ? "Trajetória descendente. Pause, revise os últimos 3 períodos e identifique o que mudou."
            : "Trajetória estável. Para evoluir, aumente a taxa de experimentos ou ataque um gargalo identificado.",
      patterns: [] as string[],
    };
    const winsAll = list.flatMap((b) => b.wins);
    const setbacksAll = list.flatMap((b) => b.setbacks);
    if (winsAll.length > setbacksAll.length * 2) mentorSummary.patterns.push("Padrão de execução positiva consistente.");
    if (setbacksAll.length > winsAll.length * 2) mentorSummary.patterns.push("Padrão de fricção recorrente — investigue causa raiz.");
    if (completedExp >= 5) mentorSummary.patterns.push("Cultura experimental instalada.");
    if (totalDecisions >= 10 && completedExp < 3) mentorSummary.patterns.push("Muitas decisões, poucos testes — risco de viés.");

    return { periods: list, mentor: mentorSummary };
  });
