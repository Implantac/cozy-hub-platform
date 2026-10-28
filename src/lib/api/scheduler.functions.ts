import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runSchedulerTick } from "@/lib/scheduler/dispatcher.server";
import { throwIfError } from "./_supabase";

/**
 * Enqueue a content for publication on one or more channels.
 * Delegates to RPC enqueue_publication which enforces workspace role + scheduling rules.
 */
export const enqueuePublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        contentId: z.string().uuid(),
        channelIds: z.array(z.string().uuid()).min(1).max(20),
        scheduledAt: z.string().datetime(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: jobs, error } = await supabase.rpc("enqueue_publication", {
      _content_id: data.contentId,
      _channel_ids: data.channelIds,
      _scheduled_at: data.scheduledAt,
    });
    throwIfError(error);
    return jobs ?? [];
  });

export const listSchedulerJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        status: z.enum(["pending", "processing", "succeeded", "failed", "dead_letter"]).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("scheduler_jobs")
      .select("*, content:content(title,type), channel:channels(platform,handle)")
      .eq("workspace_id", data.workspaceId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q
      .order("scheduled_at", { ascending: false })
      .limit(data.limit);
    throwIfError(error);
    return rows ?? [];
  });

export const cancelSchedulerJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        jobId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // RLS + status check: only pending jobs in the requested workspace can be canceled.
    const { data: row, error } = await supabase
      .from("scheduler_jobs")
      .update({ status: "failed", last_error: "canceled by user" })
      .eq("id", data.jobId)
      .eq("workspace_id", data.workspaceId)
      .eq("status", "pending")
      .select()
      .single();
    throwIfError(error);
    return row;
  });

/**
 * Manual tick — runs the dispatcher on demand.
 * Gated to workspace owners/admins to avoid letting any signed-in user
 * trigger publication of jobs they don't own.
 *
 * NOTE: the dispatcher itself currently claims globally via service-role
 * RPCs; this guard restricts the *trigger* surface to privileged callers.
 */
export const runSchedulerTickManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(10),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member, error } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    throwIfError(error);
    if (!member || !["owner", "admin"].includes(member.role)) {
      throw new Error("forbidden: only workspace owners/admins can run the dispatcher");
    }
    return runSchedulerTick({ limit: data.limit });
  });
