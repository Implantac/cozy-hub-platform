/**
 * VELT — Analytics sync orchestrator (server-only).
 *
 * Closes the loop that was open in round 1.1.0: until now `analytics_snapshots`
 * was never populated, so best-time-to-post always ran on baselines and the
 * Brain's growth engine could not see a real trend.
 *
 * What it does, per workspace:
 *   1. find channels that are connected and have a published post to measure
 *   2. refresh the token (reusing the publisher's refresh layer)
 *   3. collect per-post metrics for posts published in the last N days
 *   4. write one `analytics_snapshots` row per post per run, de-duplicated to a
 *      daily cadence so history stays readable
 *
 * Design decisions worth stating:
 *   - **Idempotent per day.** Re-running the sync on the same day updates the
 *     existing snapshot instead of appending, so retries and manual triggers are
 *     safe and charts do not double-count.
 *   - **Cumulative, not additive.** Platform counters are cumulative per post;
 *     merging takes the max (see `mergeCumulative`), never the sum.
 *   - **Failures are per channel, not per run.** One expired token must not stop
 *     the other nine channels from syncing.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getFreshToken } from "@/lib/oauth/refresh.server";
import { InsightAuthError, InsightRateLimitError, collectorFor } from "./insights.server";
import { EMPTY_METRICS, mergeCumulative, type CanonicalMetrics } from "./normalize";
import { precheckMedia } from "@/lib/scheduler/media";

/** Only posts newer than this are worth polling; older ones plateau. */
const DEFAULT_LOOKBACK_DAYS = 30;
/** Cap per channel per run — protects provider quotas. */
const MAX_POSTS_PER_CHANNEL = 25;

export interface SyncSummary {
  channelsConsidered: number;
  channelsSynced: number;
  postsMeasured: number;
  snapshotsWritten: number;
  skipped: Array<{ channelId: string; platform: string; reason: string }>;
  errors: Array<{ channelId: string; platform: string; error: string }>;
  durationMs: number;
}

interface ChannelRow {
  id: string;
  workspace_id: string;
  platform: string;
  external_id: string | null;
  metadata: Record<string, unknown> | null;
  status: string;
}

interface JobRow {
  id: string;
  channel_id: string;
  content_id: string;
  external_post_id: string | null;
  scheduled_at: string | null;
  workspace_id: string;
}

/**
 * Syncs one platform channel. Returns counts; never throws for per-post issues.
 */
async function syncChannel(
  channel: ChannelRow,
  lookbackDays: number,
): Promise<{
  postsMeasured: number;
  snapshotsWritten: number;
  skipped?: string;
  error?: string;
}> {
  const collect = collectorFor(channel.platform);
  if (!collect) return { postsMeasured: 0, snapshotsWritten: 0, skipped: "sem coletor" };

  const since = new Date(Date.now() - lookbackDays * 86400_000).toISOString();

  const { data: jobs, error: jobErr } = await supabaseAdmin
    .from("scheduler_jobs")
    .select("id, channel_id, content_id, external_post_id, scheduled_at, workspace_id")
    .eq("channel_id", channel.id)
    .eq("status", "succeeded")
    .not("external_post_id", "is", null)
    .gte("scheduled_at", since)
    .order("scheduled_at", { ascending: false })
    .limit(MAX_POSTS_PER_CHANNEL);

  if (jobErr) return { postsMeasured: 0, snapshotsWritten: 0, error: jobErr.message };
  const rows = (jobs ?? []) as JobRow[];
  if (rows.length === 0) {
    return { postsMeasured: 0, snapshotsWritten: 0, skipped: "nenhuma publicação recente" };
  }

  let accessToken: string;
  try {
    const fresh = await getFreshToken(channel.id, channel.platform);
    accessToken = fresh.accessToken;
  } catch (err) {
    return {
      postsMeasured: 0,
      snapshotsWritten: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  let measured = 0;
  let written = 0;

  for (const job of rows) {
    if (!job.external_post_id) continue;

    // Simulated publishes have no upstream resource to query.
    if (job.external_post_id.startsWith("sim_")) continue;

    let metrics: CanonicalMetrics = { ...EMPTY_METRICS };
    let followers: number | undefined;

    try {
      const result = await collect({
        platform: channel.platform,
        externalPostId: job.external_post_id,
        accessToken,
        channelConfig: channel.metadata ?? {},
        channelExternalId: channel.external_id,
      });
      if (!result) continue; // platform cannot report — not an error
      metrics = result.metrics;
      followers = result.accountFollowers;
    } catch (err) {
      if (err instanceof InsightRateLimitError) {
        // Stop this channel, keep the posts already measured.
        return {
          postsMeasured: measured,
          snapshotsWritten: written,
          error: "rate limit — restante da fila fica para o próximo ciclo",
        };
      }
      if (err instanceof InsightAuthError) {
        await supabaseAdmin
          .from("channels")
          .update({
            status: "expired",
            metadata: { ...(channel.metadata ?? {}), sync_error: "token expirado" },
          })
          .eq("id", channel.id);
        return { postsMeasured: measured, snapshotsWritten: written, error: err.message };
      }
      // Per-post failure: log and continue with the next post.
      console.warn(`[analytics] post ${job.external_post_id} failed: ${(err as Error).message}`);
      continue;
    }

    measured += 1;

    // De-duplicate to one snapshot per post per day.
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const { data: existing } = await supabaseAdmin
      .from("analytics_snapshots")
      .select("id, metrics")
      .eq("channel_id", channel.id)
      .eq("content_id", job.content_id)
      .gte("captured_at", dayStart.toISOString())
      .maybeSingle();

    const merged = mergeCumulative(
      (existing?.metrics as Partial<CanonicalMetrics> | null) ?? EMPTY_METRICS,
      metrics,
    );
    const payload = {
      ...merged,
      ...(followers !== undefined ? { followers } : {}),
      post_id: job.external_post_id,
      job_id: job.id,
      source: "sync",
      collected_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from("analytics_snapshots")
        .update({ metrics: payload as never })
        .eq("id", existing.id);
      if (!error) written += 1;
    } else {
      const { error } = await supabaseAdmin.from("analytics_snapshots").insert({
        workspace_id: channel.workspace_id,
        channel_id: channel.id,
        content_id: job.content_id,
        metrics: payload as never,
      });
      if (!error) written += 1;
    }
  }

  await supabaseAdmin
    .from("channels")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", channel.id);

  return { postsMeasured: measured, snapshotsWritten: written };
}

/**
 * Runs the analytics sync.
 *
 * `workspaceId` scopes it to a single workspace (manual trigger from the UI);
 * omitting it sweeps every connected channel (cron).
 */
export async function runAnalyticsSync(
  opts: { workspaceId?: string; lookbackDays?: number; maxChannels?: number } = {},
): Promise<SyncSummary> {
  const started = Date.now();
  const lookbackDays = opts.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const limit = opts.maxChannels ?? 50;

  let query = supabaseAdmin
    .from("channels")
    .select("id, workspace_id, platform, external_id, metadata, status")
    .eq("status", "connected")
    .limit(limit);

  if (opts.workspaceId) query = query.eq("workspace_id", opts.workspaceId);

  const { data: channels, error } = await query;
  if (error) throw new Error(`analytics sync: ${error.message}`);

  const summary: SyncSummary = {
    channelsConsidered: channels?.length ?? 0,
    channelsSynced: 0,
    postsMeasured: 0,
    snapshotsWritten: 0,
    skipped: [],
    errors: [],
    durationMs: 0,
  };

  for (const raw of channels ?? []) {
    const channel = raw as ChannelRow;
    const result = await syncChannel(channel, lookbackDays);
    if (result.skipped) {
      summary.skipped.push({
        channelId: channel.id,
        platform: channel.platform,
        reason: result.skipped,
      });
    }
    if (result.error) {
      summary.errors.push({
        channelId: channel.id,
        platform: channel.platform,
        error: result.error,
      });
    }
    if (result.snapshotsWritten > 0) summary.channelsSynced += 1;
    summary.postsMeasured += result.postsMeasured;
    summary.snapshotsWritten += result.snapshotsWritten;
  }

  summary.durationMs = Date.now() - started;
  return summary;
}

/** Media sanity check reused by the UI to explain why a post has no metrics. */
export { precheckMedia };
