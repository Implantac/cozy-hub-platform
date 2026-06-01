/**
 * USE Brain — public server functions.
 * Modules call these instead of computing their own intelligence.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "./_types";
import {
  loadContext, runEngines, computeScores, buildSnapshot, answerQuestion, aggregateSignals, aggregateActions,
} from "@/lib/brain/brain";
import { throwIfError } from "./_supabase";

const wsInput = z.object({ workspaceId: z.string().uuid() });

/** Compute a fresh snapshot, persist it, invalidate cached answers. */
export const brainSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const snap = await buildSnapshot(supabase, data.workspaceId, userId);

    const { data: row, error } = await supabase.from("brain_snapshots").insert({
      workspace_id: snap.workspace_id,
      snapshot: snap.snapshot as unknown as Json,
      scores: snap.scores as unknown as Json,
      signals: snap.signals as unknown as Json,
    }).select().single();
    throwIfError(error);

    // Mirror score into digital_scores for back-compat with Score module
    await supabase.from("digital_scores").insert({
      workspace_id: data.workspaceId,
      overall: snap.scores.overall,
      presence: snap.scores.presence,
      branding: snap.scores.branding,
      content: snap.scores.content,
      consistency: snap.scores.consistency,
      growth: snap.scores.growth,
      channel_setup: snap.scores.channel_setup,
      breakdown: { gaps: snap.signals.filter((s) => s.kind === "negative").map((s) => s.message).slice(0, 6) },
    });

    // Invalidate cached answers
    await supabase.from("brain_answers").delete().eq("workspace_id", data.workspaceId);
    return row;
  });

/** Answer one of the five canonical questions. Uses cached answer if fresh (<1h). */
export const brainAsk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspaceId: z.string().uuid(),
    question: z.enum(["where_am_i","where_to_go","whats_blocking","next_action","should_pivot"]),
    forceRefresh: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!data.forceRefresh) {
      const { data: cached } = await supabase.from("brain_answers")
        .select("*").eq("workspace_id", data.workspaceId).eq("question", data.question)
        .order("computed_at", { ascending: false }).limit(1).maybeSingle();
      if (cached && (!cached.expires_at || new Date(cached.expires_at).getTime() > Date.now())) {
        return cached.answer;
      }
    }

    const ctx = await loadContext(supabase, data.workspaceId, userId);
    const reports = runEngines(ctx);
    const scores = computeScores(ctx, reports);
    const answer = answerQuestion(data.question, ctx, reports, scores);

    const expires = new Date(Date.now() + 60 * 60_000).toISOString();
    await supabase.from("brain_answers").insert({
      workspace_id: data.workspaceId, question: data.question,
      answer: answer as unknown as Json, confidence: answer.confidence, expires_at: expires,
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
    const questions = ["where_am_i","where_to_go","whats_blocking","next_action","should_pivot"] as const;
    const answers = questions.map((q) => answerQuestion(q, ctx, reports, scores));
    return { scores, signals: aggregateSignals(reports), actions: aggregateActions(reports), answers };
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
    const recs: Array<any> = [];
    for (const a of actions.slice(0, 6)) {
      recs.push({
        workspace_id: data.workspaceId, user_id: userId,
        kind: "next_action", severity: a.score >= 85 ? "high" : a.score >= 60 ? "medium" : "low",
        title: a.title, body: a.rationale,
        cta: a.href ? { label: "Abrir", href: a.href } : {},
        score: a.score,
      });
    }
    for (const s of signals.filter((x) => x.kind === "negative" && x.severity !== "low").slice(0, 4)) {
      recs.push({
        workspace_id: data.workspaceId, user_id: userId,
        kind: "warning", severity: s.severity,
        title: s.message, body: `Detectado pelo motor ${s.engine}.`,
        cta: {}, score: Math.round(s.weight * 100),
      });
    }
    if (recs.length === 0) {
      recs.push({
        workspace_id: data.workspaceId, user_id: userId,
        kind: "insight", severity: "info",
        title: "Tudo em ordem — mantenha a cadência",
        body: "Sem bloqueadores críticos. Continue publicando.", cta: {}, score: 30,
      });
    }

    // Close previous open recs
    await supabase.from("coach_recommendations")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("workspace_id", data.workspaceId).is("dismissed_at", null).is("completed_at", null);

    const { data: rows, error } = await supabase.from("coach_recommendations").insert(recs).select();
    throwIfError(error);

    // Remember that we generated insights
    await supabase.from("brain_memory_events").insert({
      workspace_id: data.workspaceId, user_id: userId,
      kind: "signal", subject: "Brain gerou novas recomendações",
      payload: { count: rows?.length ?? 0 },
    });

    return { generated: rows?.length ?? 0 };
  });

/** Record a memory event (decision/result/pivot/signal/reflection). */
export const brainRemember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspaceId: z.string().uuid(),
    kind: z.enum(["decision","result","pivot","signal","reflection"]),
    subject: z.string().min(1).max(280),
    payload: z.record(z.string(), z.unknown()).optional(),
    sentiment: z.enum(["positive","neutral","negative"]).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("brain_memory_events").insert({
      workspace_id: data.workspaceId, user_id: userId,
      kind: data.kind, subject: data.subject,
      payload: (data.payload ?? {}) as Json, sentiment: data.sentiment ?? null,
    }).select().single();
    throwIfError(error);
    return row;
  });

/** Cronological memory: decisions/results/pivots over time. */
export const brainTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.from("brain_memory_events")
      .select("*").eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false }).limit(100);
    throwIfError(error);
    return rows ?? [];
  });

/** Latest persisted snapshot (cheap read). */
export const brainLatestSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase.from("brain_snapshots")
      .select("*").eq("workspace_id", data.workspaceId)
      .order("computed_at", { ascending: false }).limit(1).maybeSingle();
    throwIfError(error);
    return row;
  });
