import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";

/**
 * Native Cognitive Brain — Phase 1
 * - Rule Engine baseline: derive recommendations from workspace state.
 * - Memory layer: durable text + (future) embeddings.
 * - Recommendation feed.
 */

async function assertWorkspaceMember(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  allowedRoles?: string[],
) {
  const { data: member, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError(error);
  if (!member) throw new Error("forbidden: not a workspace member");
  if (allowedRoles && !allowedRoles.includes(member.role)) {
    throw new Error("forbidden: insufficient role");
  }
}

export const listRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertWorkspaceMember(supabase, data.workspaceId, userId);
    const { data: rows, error } = await supabase
      .from("brain_recommendations").select("*").eq("workspace_id", data.workspaceId)
      .order("score", { ascending: false }).limit(50);
    throwIfError(error);
    return rows ?? [];
  });

export const updateRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspaceId: z.string().uuid(),
      id: z.string().uuid(),
      status: z.enum(["open", "applied", "dismissed", "expired"]),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertWorkspaceMember(supabase, data.workspaceId, userId, ["owner", "admin", "editor"]);
    const { error } = await supabase
      .from("brain_recommendations")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    throwIfError(error);
    return { ok: true };
  });

/**
 * /brain/recommend — Rule Engine over current workspace state.
 * Generates fresh recommendations using simple, explainable heuristics.
 */
export const runBrainRecommend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertWorkspaceMember(supabase, data.workspaceId, userId);
    const ws = data.workspaceId;

    type ChannelRow = { id: string; platform: string; status: string };
    type ContentRow = { id: string; status: string; created_at: string };
    type MissionRow = { id: string; status: string };

    const [{ data: brands }, { data: channels }, { data: content }, { data: missions }] = await Promise.all([
      supabase.from("brands").select("id").eq("workspace_id", ws),
      supabase.from("channels").select("id, platform, status").eq("workspace_id", ws),
      supabase.from("content").select("id, status, created_at").eq("workspace_id", ws),
      supabase.from("missions").select("id, status").eq("workspace_id", ws),
    ]);

    const recs: Array<{ kind: string; title: string; rationale: string; score: number; payload: Record<string, unknown> }> = [];

    if (!brands || brands.length === 0) {
      recs.push({
        kind: "setup.brand",
        title: "Create your first brand",
        rationale: "A brand defines voice, palette and channels — the cornerstone of Digital OS.",
        score: 0.95,
        payload: { action: "create_brand" },
      });
    }

    const platforms = new Set(((channels ?? []) as ChannelRow[]).map((c) => c.platform));
    const targetPlatforms = ["instagram", "youtube", "tiktok", "linkedin"];
    for (const p of targetPlatforms) {
      if (!platforms.has(p)) {
        recs.push({
          kind: "setup.channel",
          title: `Connect ${p[0].toUpperCase() + p.slice(1)}`,
          rationale: `You don't have ${p} connected yet. Multi-channel presence amplifies reach.`,
          score: 0.7,
          payload: { action: "connect_channel", platform: p },
        });
      }
    }

    const drafts = ((content ?? []) as ContentRow[]).filter((c) => c.status === "draft").length;
    if (drafts >= 3) {
      recs.push({
        kind: "ops.publish",
        title: `You have ${drafts} drafts waiting`,
        rationale: "Drafts shipped weekly outperform irregular bursts. Schedule them.",
        score: 0.6,
        payload: { action: "open_scheduler" },
      });
    }

    const open = ((missions ?? []) as MissionRow[]).filter((m) => m.status === "pending").length;
    if (open === 0) {
      recs.push({
        kind: "growth.mission",
        title: "Define a 7-day growth mission",
        rationale: "Missions create a feedback loop. The Brain learns from your outcomes.",
        score: 0.55,
        payload: { action: "create_mission" },
      });
    }

    // Persist as open recommendations (replace previous open of same kind)
    if (recs.length > 0) {
      await supabase.from("brain_recommendations")
        .update({ status: "expired" })
        .eq("workspace_id", ws).eq("status", "open");

      await supabase.from("brain_recommendations").insert(
        recs.map((r) => ({
          workspace_id: ws, kind: r.kind, title: r.title, rationale: r.rationale,
          payload: r.payload as never, score: r.score, status: "open" as const,
        }))
      );

      await supabase.from("domain_events").insert({
        workspace_id: ws, event_type: "BrainRecommendationCreated",
        payload: { count: recs.length },
      });
    }

    return { generated: recs.length };
  });

/* Memory layer (kind/content; embedding optional, populated by future worker) */
export const listMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertWorkspaceMember(supabase, data.workspaceId, userId);
    const { data: rows, error } = await supabase
      .from("brain_memories").select("id, kind, content, metadata, created_at")
      .eq("workspace_id", data.workspaceId).order("created_at", { ascending: false }).limit(50);
    throwIfError(error);
    return rows ?? [];
  });

export const addMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspaceId: z.string().uuid(),
      kind: z.enum(["fact", "preference", "goal", "signal", "outcome", "strategy"]),
      content: z.string().min(2).max(4000),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertWorkspaceMember(supabase, data.workspaceId, userId, ["owner", "admin", "editor"]);
    const { data: row, error } = await supabase.from("brain_memories").insert({
      workspace_id: data.workspaceId, kind: data.kind, content: data.content,
    }).select("id, kind, content, metadata, created_at").single();
    throwIfError(error);
    return row;
  });
