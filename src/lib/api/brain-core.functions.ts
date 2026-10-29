/**
 * USE Brain — public server functions.
 * Modules call these instead of computing their own intelligence.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "./_types";
import {
  loadContext,
  runEngines,
  computeScores,
  answerQuestion,
  aggregateSignals,
  aggregateActions,
} from "@/lib/brain/brain";
import { runAIInsights } from "@/lib/brain/ai-insights.server";
import type { BrainAnswer, BrainQuestion } from "@/lib/brain/types";
import { throwIfError } from "./_supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * The AI note persisted alongside a snapshot (Brain-3 enrichment).
 *
 * Typed explicitly because the column is `Json`: without a declared shape, every
 * `ai.something` below is unchecked, and a renamed key becomes `undefined`
 * instead of a compile error.
 */
export type PersistedAI = {
  narrative?: string | null;
  blueprintGaps?: string[] | null;
  /** Per-opportunity justification; shape declared by `ai-insights.server.ts`. */
  opportunityRationales?: Array<{ id: string; why: string }> | null;
  pivotAdvice?: string | null;
  trustNotes?: string[] | null;
};

/** Pull AI insights from the latest persisted snapshot (cheap read, no Gateway call). */
async function readAIFromLatest(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
): Promise<PersistedAI | null> {
  const { data } = await supabase
    .from("brain_snapshots")
    .select("snapshot")
    .eq("workspace_id", workspaceId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const snapshot = data?.snapshot;
  if (!snapshot || typeof snapshot !== "object") return null;
  const ai = (snapshot as { ai?: unknown }).ai;
  return ai && typeof ai === "object" ? (ai as PersistedAI) : null;
}

/** Brain-3: enrich a rule-based answer with the AI note relevant to its question. */
function enrichWithAI(answer: BrainAnswer, ai: PersistedAI | null): BrainAnswer {
  if (!ai) return { ...answer, source: "rules" };
  let aiNote: string | null = null;
  switch (answer.question as BrainQuestion) {
    case "where_am_i":
      aiNote = ai.narrative ?? null;
      break;
    case "whats_blocking":
      aiNote = (ai.blueprintGaps ?? [])[0] ?? null;
      break;
    case "should_pivot":
      aiNote = ai.pivotAdvice ?? null;
      break;
    case "next_action":
      aiNote = (ai.opportunityRationales ?? [])[0]?.why ?? null;
      break;
    case "where_to_go":
      aiNote = (ai.trustNotes ?? [])[0] ?? null;
      break;
  }
  return { ...answer, aiNote, source: aiNote ? "ai" : "rules" };
}

const wsInput = z.object({ workspaceId: z.string().uuid() });

/** Compute a fresh snapshot, persist it, invalidate cached answers. */
export const brainSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Brain-3: load context ONCE, reuse for snapshot + AI insights.
    const ctx = await loadContext(supabase, data.workspaceId, userId);
    const reports = runEngines(ctx);
    const scores = computeScores(ctx, reports);
    const signals = aggregateSignals(reports);

    const ai = await runAIInsights(ctx, reports, scores);
    const enrichedSnapshot = {
      user: reports.user.facts,
      business: reports.business.facts,
      growth: reports.growth.facts,
      market: reports.market.facts,
      opportunity: reports.opportunity.facts,
      trust: reports.trust.facts,
      memory_size: ctx.memory.length,
      ai,
    };

    const { data: row, error } = await supabase
      .from("brain_snapshots")
      .insert({
        workspace_id: data.workspaceId,
        snapshot: enrichedSnapshot as unknown as Json,
        scores: scores as unknown as Json,
        signals: signals as unknown as Json,
      })
      .select()
      .single();
    throwIfError(error);

    // Mirror score into digital_scores for back-compat with Score module
    await supabase.from("digital_scores").insert({
      workspace_id: data.workspaceId,
      overall: scores.overall,
      presence: scores.presence,
      branding: scores.branding,
      content: scores.content,
      consistency: scores.consistency,
      growth: scores.growth,
      channel_setup: scores.channel_setup,
      breakdown: {
        gaps: signals
          .filter((s) => s.kind === "negative")
          .map((s) => s.message)
          .slice(0, 6),
      },
    });

    // Invalidate cached answers
    await supabase.from("brain_answers").delete().eq("workspace_id", data.workspaceId);
    return row;
  });

/** Answer one of the five canonical questions. Uses cached answer if fresh (<1h). */
export const brainAsk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        question: z.enum([
          "where_am_i",
          "where_to_go",
          "whats_blocking",
          "next_action",
          "should_pivot",
        ]),
        forceRefresh: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!data.forceRefresh) {
      const { data: cached } = await supabase
        .from("brain_answers")
        .select("*")
        .eq("workspace_id", data.workspaceId)
        .eq("question", data.question)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached && (!cached.expires_at || new Date(cached.expires_at).getTime() > Date.now())) {
        return cached.answer;
      }
    }

    const ctx = await loadContext(supabase, data.workspaceId, userId);
    const reports = runEngines(ctx);
    const scores = computeScores(ctx, reports);
    const base = answerQuestion(data.question, ctx, reports, scores);
    const ai = await readAIFromLatest(supabase, data.workspaceId);
    const answer = enrichWithAI(base, ai);

    const expires = new Date(Date.now() + 60 * 60_000).toISOString();
    await supabase.from("brain_answers").insert({
      workspace_id: data.workspaceId,
      question: data.question,
      answer: answer as unknown as Json,
      confidence: answer.confidence,
      expires_at: expires,
    });
    return answer;
  });

/** Convenience: ask all five questions in one call. */
export const brainAskAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await loadContext(supabase, data.workspaceId, userId);
    const reports = runEngines(ctx);
    const scores = computeScores(ctx, reports);
    const ai = await readAIFromLatest(supabase, data.workspaceId);
    const questions = [
      "where_am_i",
      "where_to_go",
      "whats_blocking",
      "next_action",
      "should_pivot",
    ] as const;
    const answers = questions.map((q) => enrichWithAI(answerQuestion(q, ctx, reports, scores), ai));
    return {
      scores,
      signals: aggregateSignals(reports),
      actions: aggregateActions(reports),
      answers,
    };
  });

/** Generate rule-based recommendations into coach_recommendations (Brain-powered). */
export const brainRecommend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await loadContext(supabase, data.workspaceId, userId);
    const reports = runEngines(ctx);
    const actions = aggregateActions(reports);
    const signals = aggregateSignals(reports);

    // Map top actions + top negative signals into coach_recommendations
    const recs: Array<Database["public"]["Tables"]["coach_recommendations"]["Insert"]> = [];
    for (const a of actions.slice(0, 6)) {
      recs.push({
        workspace_id: data.workspaceId,
        user_id: userId,
        kind: "next_action",
        severity: a.score >= 85 ? "high" : a.score >= 60 ? "medium" : "low",
        title: a.title,
        body: a.rationale,
        cta: a.href ? { label: "Abrir", href: a.href } : {},
        score: a.score,
      });
    }
    for (const s of signals
      .filter((x) => x.kind === "negative" && x.severity !== "low")
      .slice(0, 4)) {
      recs.push({
        workspace_id: data.workspaceId,
        user_id: userId,
        kind: "warning",
        severity: s.severity,
        title: s.message,
        body: `Detectado pelo motor ${s.engine}.`,
        cta: {},
        score: Math.round(s.weight * 100),
      });
    }
    if (recs.length === 0) {
      recs.push({
        workspace_id: data.workspaceId,
        user_id: userId,
        kind: "insight",
        severity: "info",
        title: "Tudo em ordem — mantenha a cadência",
        body: "Sem bloqueadores críticos. Continue publicando.",
        cta: {},
        score: 30,
      });
    }

    // Close previous open recs
    await supabase
      .from("coach_recommendations")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("workspace_id", data.workspaceId)
      .is("dismissed_at", null)
      .is("completed_at", null);

    const { data: rows, error } = await supabase
      .from("coach_recommendations")
      .insert(recs)
      .select();
    throwIfError(error);

    // Remember that we generated insights
    await supabase.from("brain_memory_events").insert({
      workspace_id: data.workspaceId,
      user_id: userId,
      kind: "signal",
      subject: "Brain gerou novas recomendações",
      payload: { count: rows?.length ?? 0 },
    });

    return { generated: rows?.length ?? 0 };
  });

/** Record a memory event (decision/result/pivot/signal/reflection). */
export const brainRemember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        kind: z.enum(["decision", "result", "pivot", "signal", "reflection"]),
        subject: z.string().min(1).max(280),
        payload: z.record(z.string(), z.unknown()).optional(),
        sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("brain_memory_events")
      .insert({
        workspace_id: data.workspaceId,
        user_id: userId,
        kind: data.kind,
        subject: data.subject,
        payload: (data.payload ?? {}) as Json,
        sentiment: data.sentiment ?? null,
      })
      .select()
      .single();
    throwIfError(error);
    return row;
  });

/** Cronological memory: decisions/results/pivots over time. */
export const brainTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("brain_memory_events")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);
    throwIfError(error);
    return rows ?? [];
  });

/** Latest persisted snapshot (cheap read). */
export const brainLatestSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("brain_snapshots")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfError(error);
    return row;
  });

/**
 * Brain-ranked opportunities — combines market data with the user's profile
 * (preferred channels, content prefs, goals, experience) to compute a
 * compatibility match instead of returning a generic trends list.
 */
export const brainOpportunities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        status: z.enum(["exploding", "growing", "stable", "saturated", "declining"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await loadContext(supabase, data.workspaceId, userId);

    const profile = ctx.profile;
    const userTags: string[] = [
      ...(profile?.preferred_channels ?? []),
      ...(profile?.content_preferences ?? []),
      ...(profile?.goals ?? []),
      profile?.business_path,
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    const difficultyPenalty: Record<string, number> = { low: 0, medium: 10, high: 25 };
    const userTolerance =
      profile?.experience_level === "advanced"
        ? 30
        : profile?.experience_level === "intermediate"
          ? 15
          : 0;

    // Brain-3: read AI opportunity rationales from the latest snapshot.
    const ai = await readAIFromLatest(supabase, data.workspaceId);
    const rationaleById = new Map<string, string>(
      ((ai?.opportunityRationales ?? []) as Array<{ id: string; why: string }>).map((r) => [
        r.id,
        r.why,
      ]),
    );

    const scored = (ctx.opportunities ?? []).map((o) => {
      let s = 50;
      if (o.status === "exploding") s += 25;
      else if (o.status === "growing") s += 15;
      else if (o.status === "saturated") s -= 15;
      else if (o.status === "declining") s -= 30;
      if (o.growth_potential === "high") s += 15;
      if (o.competition === "low") s += 10;
      if (o.competition === "high") s -= 10;
      s -= Math.max(0, (difficultyPenalty[o.difficulty] ?? 10) - userTolerance);
      const tags: string[] = (o.tags ?? []).map((t) => String(t).toLowerCase());
      s += tags.filter((t) => userTags.includes(t)).length * 8;
      return {
        ...o,
        _compatibility: Math.max(0, Math.min(100, s)),
        _aiRationale: rationaleById.get(o.id) ?? null,
      };
    });

    const ranked = scored
      .filter((o) => !data.status || o.status === data.status)
      .sort((a, b) => b._compatibility - a._compatibility)
      .slice(0, data.limit ?? 60);

    return ranked;
  });
