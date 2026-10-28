/**
 * VELT — Analytics sync (manual trigger + status).
 *
 * The cron endpoint handles the scheduled sweep. This exposes the same work to
 * the workspace owner so the loop can be closed on demand ("medir agora") and so
 * the UI can explain *why* a channel has no data — an empty chart with no
 * explanation is the fastest way to lose trust in a product.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";
import { runAnalyticsSync } from "@/lib/analytics/sync.server";

/**
 * Runs the sync for one workspace.
 *
 * Gated to owner/admin: this calls out to provider APIs with the workspace's
 * stored credentials and consumes shared rate-limit budget, so any signed-in
 * viewer must not be able to trigger it.
 */
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

    return runAnalyticsSync({
      workspaceId: data.workspaceId,
      lookbackDays: data.lookbackDays,
    });
  });

/**
 * Readiness report — what the sync will be able to do for this workspace.
 * Powers the "por que meu gráfico está vazio?" explanation.
 */
export const getMetricsReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: channels, error } = await supabase
      .from("channels")
      .select("id, platform, status, last_synced_at")
      .eq("workspace_id", data.workspaceId);
    throwIfError(error);

    const { count: publishedCount } = await supabase
      .from("scheduler_jobs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", data.workspaceId)
      .eq("status", "succeeded")
      .not("external_post_id", "is", null);

    const { count: snapshotCount } = await supabase
      .from("analytics_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", data.workspaceId);

    const byPlatform = (channels ?? []).map((c) => ({
      platform: String(c.platform),
      status: String(c.status),
      lastSyncedAt: c.last_synced_at,
      /** Platforms whose insight API is wired; TikTok needs a separate scope. */
      insightCapable: !["tiktok"].includes(String(c.platform)),
    }));

    return {
      channels: byPlatform,
      connectedChannels: byPlatform.filter((c) => c.status === "connected").length,
      measurableChannels: byPlatform.filter((c) => c.status === "connected" && c.insightCapable)
        .length,
      publishedPosts: publishedCount ?? 0,
      snapshots: snapshotCount ?? 0,
      /** The single sentence the UI shows when there is nothing to chart. */
      reason:
        byPlatform.length === 0
          ? "Nenhum canal conectado ainda."
          : byPlatform.every((c) => c.status !== "connected")
            ? "Os canais existem mas nenhum está conectado via OAuth."
            : (publishedCount ?? 0) === 0
              ? "Ainda não há publicação efetiva — os insights vêm dos posts já publicados."
              : (snapshotCount ?? 0) === 0
                ? "Há posts publicados, mas nenhuma coleta rodou ainda."
                : null,
    };
  });
