/**
 * USE Brain — Orchestrator.
 * Builds a BrainContext, runs every engine, persists a snapshot, and answers the
 * five canonical questions:
 *   1. Where am I?
 *   2. Where do I want to go?
 *   3. What's blocking me?
 *   4. What's the next best action?
 *   5. Is it worth pivoting direction?
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BrainContext,
  BrainQuestion,
  BrainAnswer,
  BrainSnapshot,
  EngineReport,
  BrainSignal,
  BrainAction,
} from "./types";
import { analyzeUser } from "./engines/user.engine";
import { analyzeBusiness } from "./engines/business.engine";
import { analyzeGrowth } from "./engines/growth.engine";
import { analyzeMarket } from "./engines/market.engine";
import { analyzeOpportunity } from "./engines/opportunity.engine";
import { analyzeTrust } from "./engines/trust.engine";

const ENGINES = {
  user: analyzeUser,
  business: analyzeBusiness,
  growth: analyzeGrowth,
  market: analyzeMarket,
  opportunity: analyzeOpportunity,
  trust: analyzeTrust,
} as const;

export async function loadContext(
  supabase: SupabaseClient<any>,
  workspaceId: string,
  userId: string,
): Promise<BrainContext> {
  const [
    profileRes,
    wsRes,
    brandsRes,
    channelsRes,
    contentRes,
    jobsRes,
    analyticsRes,
    oppsRes,
    memRes,
    bpRes,
    compRes,
    skillsRes,
  ] = await Promise.all([
    supabase.from("user_profile_digital").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("workspaces").select("*").eq("id", workspaceId).maybeSingle(),
    supabase.from("brands").select("*").eq("workspace_id", workspaceId),
    supabase.from("channels").select("*").eq("workspace_id", workspaceId),
    supabase
      .from("content")
      .select("id, status, created_at, title, body")
      .eq("workspace_id", workspaceId)
      .limit(500),
    supabase
      .from("scheduler_jobs")
      .select("id, status, scheduled_at, content_id")
      .eq("workspace_id", workspaceId)
      .limit(500),
    supabase
      .from("analytics_snapshots")
      // `content_id` is required: the growth engine groups by post to pick the
      // latest metrics. Without it the map is always empty and best-time-to-post
      // silently degrades to baselines.
      .select("id, metrics, captured_at, content_id")
      .eq("workspace_id", workspaceId)
      .order("captured_at", { ascending: false })
      .limit(100),
    supabase
      .from("opportunities")
      .select("*")
      .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
      .limit(50),
    supabase
      .from("brain_memory_events")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("business_blueprints").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    supabase.from("competitors").select("*").eq("workspace_id", workspaceId).limit(100),
    supabase
      .from("skill_assessments")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId),
  ]);

  return {
    workspaceId,
    userId,
    profile: profileRes.data,
    workspace: wsRes.data,
    brands: brandsRes.data ?? [],
    channels: channelsRes.data ?? [],
    content: contentRes.data ?? [],
    jobs: jobsRes.data ?? [],
    analytics: analyticsRes.data ?? [],
    opportunities: oppsRes.data ?? [],
    memory: memRes.data ?? [],
    blueprint: bpRes.data ?? null,
    competitors: compRes.data ?? [],
    skills: skillsRes.data ?? [],
  };
}

export function runEngines(ctx: BrainContext): Record<string, EngineReport> {
  const reports: Record<string, EngineReport> = {};
  for (const [name, fn] of Object.entries(ENGINES)) {
    reports[name] = fn(ctx);
  }
  ctx.reports = reports;
  return reports;
}

export function computeScores(ctx: BrainContext, reports: Record<string, EngineReport>) {
  const brands = ctx.brands.length;
  const channels = ctx.channels.length;
  const connected = ctx.channels.filter((c) => c.status === "connected").length;
  const recent30 = (reports.growth.facts?.recent30 as number) ?? 0;
  const successRate = (reports.growth.facts?.successRate as number) ?? 0;

  const presence = Math.round(Math.min(brands, 1) * 40 + (Math.min(channels, 3) / 3) * 60);
  const branding =
    brands === 0
      ? 0
      : Math.round(
          ctx.brands.reduce((s, b: any) => {
            const v = b.voice && Object.keys(b.voice).length ? 35 : 0;
            const p = b.palette && Object.keys(b.palette).length ? 35 : 0;
            const l = b.logo_url ? 30 : 0;
            return s + v + p + l;
          }, 0) / brands,
        );
  const content = Math.min(100, ctx.content.length * 8);
  const consistency = Math.min(100, recent30 * 12);
  const growth = Math.round(successRate * 100);
  const channel_setup = channels === 0 ? 0 : Math.round((connected / channels) * 100);

  const overall = Math.round(
    presence * 0.18 +
      branding * 0.17 +
      content * 0.2 +
      consistency * 0.18 +
      growth * 0.14 +
      channel_setup * 0.13,
  );

  return { overall, presence, branding, content, consistency, growth, channel_setup };
}

export function aggregateSignals(reports: Record<string, EngineReport>): BrainSignal[] {
  return Object.values(reports)
    .flatMap((r) => r.signals)
    .sort((a, b) => b.weight - a.weight);
}

export function aggregateActions(reports: Record<string, EngineReport>): BrainAction[] {
  return Object.values(reports)
    .flatMap((r) => r.actions)
    .sort((a, b) => b.score - a.score);
}

export async function buildSnapshot(
  supabase: SupabaseClient<any>,
  workspaceId: string,
  userId: string,
): Promise<BrainSnapshot> {
  const ctx = await loadContext(supabase, workspaceId, userId);
  const reports = runEngines(ctx);
  const scores = computeScores(ctx, reports);
  const signals = aggregateSignals(reports);
  return {
    workspace_id: workspaceId,
    snapshot: {
      user: reports.user.facts,
      business: reports.business.facts,
      growth: reports.growth.facts,
      market: reports.market.facts,
      opportunity: reports.opportunity.facts,
      trust: reports.trust.facts,
      memory_size: ctx.memory.length,
    },
    scores,
    signals,
  };
}

/** Answer one of the five canonical questions using context + reports. */
export function answerQuestion(
  question: BrainQuestion,
  ctx: BrainContext,
  reports: Record<string, EngineReport>,
  scores: Record<string, number>,
): BrainAnswer {
  const signals = aggregateSignals(reports);
  const actions = aggregateActions(reports);
  const negatives = signals.filter((s) => s.kind === "negative");

  switch (question) {
    case "where_am_i": {
      const overall = scores.overall ?? 0;
      const stage = (reports.business.facts?.stage as string) ?? "no_identity";
      const stageLabel: Record<string, string> = {
        no_identity: "Sem identidade digital",
        identity_only: "Marca criada, sem canais",
        single_channel: "Operando com 1 canal",
        multi_channel: "Operação multicanal inicial",
        omnichannel: "Operação omnichannel",
      };
      return {
        question,
        headline: `${stageLabel[stage] ?? stage} · Digital Score ${overall}/100`,
        body: `Maturidade: ${ctx.profile?.maturity_level ?? "indefinida"}. Sinais ativos: ${signals.length}.`,
        bullets: [
          `Presença: ${scores.presence}`,
          `Branding: ${scores.branding}`,
          `Consistência: ${scores.consistency}`,
        ],
        cta: { label: "Ver pilares do Score", href: "/app/score" },
        confidence: ctx.profile ? 0.85 : 0.4,
        supporting: signals.slice(0, 3),
      };
    }
    case "where_to_go": {
      const goals: string[] = ctx.profile?.goals ?? [];
      if (goals.length === 0) {
        return {
          question,
          headline: "Você ainda não definiu objetivos",
          body: "Sem objetivos o cérebro não consegue medir progresso.",
          cta: { label: "Definir objetivos no Navigator", href: "/app/navigator" },
          confidence: 0.3,
          supporting: [],
        };
      }
      return {
        question,
        headline: `${goals.length} objetivo(s) ativo(s)`,
        body: "Cada recomendação será priorizada pelos seus objetivos.",
        bullets: goals.slice(0, 5),
        cta: { label: "Gerenciar missões", href: "/app/missions" },
        confidence: 0.8,
        supporting: [],
      };
    }
    case "whats_blocking": {
      const top3 = negatives.slice(0, 3);
      if (top3.length === 0) {
        return {
          question,
          headline: "Nenhum bloqueador crítico no momento",
          body: "Continue cadência e monitore o score semanalmente.",
          confidence: 0.7,
          supporting: [],
          cta: null,
        };
      }
      return {
        question,
        headline: `${top3.length} bloqueador(es) prioritário(s)`,
        bullets: top3.map((s) => s.message),
        cta: { label: "Abrir Coach", href: "/app/coach" },
        confidence: Math.min(0.95, 0.5 + top3[0].weight / 2),
        supporting: top3,
      };
    }
    case "next_action": {
      const top = actions[0];
      if (!top) {
        return {
          question,
          headline: "Nada urgente — mantenha a rotina",
          body: "Volte amanhã para uma nova leitura.",
          confidence: 0.6,
          supporting: [],
          cta: null,
        };
      }
      return {
        question,
        headline: top.title,
        body: top.rationale,
        cta: top.href ? { label: "Fazer agora", href: top.href } : null,
        confidence: Math.min(0.95, top.score / 100),
        supporting: signals.slice(0, 2),
      };
    }
    case "should_pivot": {
      const pivots = ctx.memory.filter((m) => m.kind === "pivot");
      const recentPivot = pivots[0];
      const stagnating = (reports.growth.facts?.recent30 as number) === 0 && ctx.content.length > 0;

      if (recentPivot) {
        const days = Math.floor(
          (Date.now() - new Date(recentPivot.created_at).getTime()) / 86400_000,
        );
        return {
          question,
          headline:
            days < 90 ? "Pivot recente — dê tempo de provar" : "Reavaliar pode fazer sentido",
          body: `Sua última mudança de direção foi há ${days} dias: ${recentPivot.subject}.`,
          bullets: stagnating ? ["Crescimento estagnado nos últimos 30 dias."] : undefined,
          cta: { label: "Ver timeline da jornada", href: "/app/coach" },
          confidence: 0.7,
          supporting: signals.slice(0, 2),
        };
      }
      return {
        question,
        headline: stagnating ? "Sinais de estagnação detectados" : "Sem indicação de pivot",
        body: stagnating
          ? "Antes de mudar de direção, teste consistência por 30 dias."
          : "Mantenha o curso atual; ajustes táticos bastam.",
        cta: stagnating ? { label: "Revisar plano", href: "/app/navigator" } : null,
        confidence: 0.6,
        supporting: signals.slice(0, 2),
      };
    }
  }
}
