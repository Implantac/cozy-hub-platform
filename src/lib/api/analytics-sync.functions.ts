/** Manual collection + an honest, read-only readiness report. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";
import { runAnalyticsSync } from "@/lib/analytics/sync.server";
import { platformsWithInsights } from "@/lib/analytics/insights.server";
import { buildMetricsReadiness } from "@/lib/analytics/readiness";

/** Provider calls consume quotas; only an owner/admin can trigger them. */
export const syncWorkspaceMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        lookbackDays: z.number().int().min(1).max(180).default(30),
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
      throw new Error("forbidden: apenas owner/admin podem disparar a coleta de métricas");
    }
    return runAnalyticsSync({ workspaceId: data.workspaceId, lookbackDays: data.lookbackDays });
  });

/** A failed read is an error, never a reassuring zero or an unsupported capability. */
export const getMetricsReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    throwIfError(memberError);
    if (!member) throw new Error("forbidden: not a member of this workspace");

    const [channelResult, publishedResult, snapshotResult] = await Promise.all([
      supabase
        .from("channels")
        .select("id, platform, status, last_synced_at")
        .eq("workspace_id", data.workspaceId),
      supabase
        .from("scheduler_jobs")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId)
        .eq("status", "succeeded")
        .not("external_post_id", "is", null)
        .not("external_post_id", "like", "sim\\_%"),
      supabase
        .from("analytics_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", data.workspaceId),
    ]);
    throwIfError(channelResult.error);
    throwIfError(publishedResult.error);
    throwIfError(snapshotResult.error);
    if (publishedResult.count === null || snapshotResult.count === null) {
      throw new Error("Metrics readiness counts were not returned");
    }
    return buildMetricsReadiness({
      channels: channelResult.data ?? [],
      insightPlatforms: platformsWithInsights(),
      publishedPosts: publishedResult.count,
      snapshots: snapshotResult.count,
      role: member.role,
    });
  });
