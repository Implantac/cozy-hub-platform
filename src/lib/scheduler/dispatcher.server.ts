/**
 * Scheduler dispatcher (server-only).
 *
 * 1. claim_scheduler_jobs(N)   -> atomically mark N pending jobs as processing
 * 2. for each: load content + channel, run publisher
 * 3. complete_scheduler_job(...) OR fail_scheduler_job(...)
 *
 * Both completion paths are RPCs that also emit `domain_events` rows, so the
 * UI can subscribe via Supabase Realtime and reflect job state instantly.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { publishToPlatform, PublisherError, type Platform } from "./publishers.server";
import { getFreshToken } from "@/lib/oauth/refresh.server";

export interface DispatchSummary {
  claimed: number;
  succeeded: number;
  failed: number;
  jobs: Array<{
    id: string;
    status: "succeeded" | "failed";
    externalPostId?: string;
    error?: string;
  }>;
}

interface SchedulerJobRow {
  id: string;
  workspace_id: string;
  content_id: string;
  channel_id: string;
  attempts: number;
  max_attempts: number;
}

async function loadContext(job: SchedulerJobRow) {
  const [{ data: content, error: cErr }, { data: channel, error: chErr }] = await Promise.all([
    supabaseAdmin
      .from("content")
      .select("id, workspace_id, title, body, media, type")
      .eq("id", job.content_id)
      .single(),
    supabaseAdmin
      .from("channels")
      .select("id, workspace_id, platform, metadata, external_id, status")
      .eq("id", job.channel_id)
      .single(),
  ]);

  if (cErr || !content) {
    throw new PublisherError(`content not found: ${cErr?.message ?? "missing"}`, {
      retryable: false,
    });
  }
  if (chErr || !channel) {
    throw new PublisherError(`channel not found: ${chErr?.message ?? "missing"}`, {
      retryable: false,
    });
  }
  if (content.workspace_id !== job.workspace_id || channel.workspace_id !== job.workspace_id) {
    throw new PublisherError("content/channel workspace does not match the job", {
      retryable: false,
    });
  }
  if (channel.status !== "connected") {
    throw new PublisherError("channel is not connected; reconnect before publishing", {
      retryable: false,
    });
  }
  return { content, channel };
}

function extractMediaUrls(media: unknown): string[] {
  if (!Array.isArray(media)) return [];
  return media
    .map((m) => (typeof m === "string" ? m : (m as { url?: string })?.url))
    .filter((u): u is string => typeof u === "string");
}

async function processOne(job: SchedulerJobRow): Promise<DispatchSummary["jobs"][number]> {
  let externalPostId: string | undefined;
  try {
    const { content, channel } = await loadContext(job);
    const platform = channel.platform as Platform;

    // Refresh before publishing: a job scheduled weeks ahead will almost never
    // still hold a valid token. Refresh failures are mapped to the retry
    // contract so a revoked channel goes to the DLQ instead of retrying forever.
    let accessToken: string | null = null;
    try {
      const fresh = await getFreshToken(job.channel_id, platform);
      accessToken = fresh.accessToken;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new PublisherError(`token refresh falhou: ${msg}`, {
        retryable: !/sem token|reconecte|revogad|invalid_grant/i.test(msg),
      });
    }

    const result = await publishToPlatform({
      jobId: job.id,
      workspaceId: job.workspace_id,
      channelId: job.channel_id,
      contentId: job.content_id,
      platform,
      payload: {
        title: content.title,
        body: content.body,
        media_urls: extractMediaUrls(content.media),
      },
      channelConfig: {
        ...((channel.metadata as Record<string, unknown> | null) ?? {}),
        external_id: channel.external_id ?? undefined,
        ...(accessToken ? { access_token: accessToken } : {}),
      },
    });

    if (typeof result.externalPostId !== "string" || !result.externalPostId.trim())
      throw new PublisherError(
        "Resposta do provedor sem identificador confirmado. Verifique antes de republicar.",
        { retryable: false },
      );
    externalPostId = result.externalPostId;
    const { data: completed, error } = await supabaseAdmin.rpc("complete_scheduler_job", {
      _job_id: job.id,
      _external_post_id: result.externalPostId,
    });
    if (error) throw new Error(error.message);
    if (
      !completed ||
      completed.id !== job.id ||
      completed.workspace_id !== job.workspace_id ||
      completed.status !== "succeeded" ||
      completed.external_post_id !== externalPostId
    )
      throw new Error("Confirmação da publicação no banco não retornou o estado esperado.");
    return { id: job.id, status: "succeeded", externalPostId };
  } catch (err) {
    if (err instanceof PublisherError && err.externalPostId) externalPostId = err.externalPostId;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scheduler] job ${job.id} failed:`, message);
    const { data: recorded, error } = await supabaseAdmin.rpc("fail_scheduler_job", {
      _job_id: job.id,
      _error: message.slice(0, 1000),
      _retryable: externalPostId ? false : err instanceof PublisherError ? err.retryable : false,
      _external_post_id: externalPostId ?? null,
    });
    if (
      !error &&
      externalPostId &&
      recorded?.id === job.id &&
      recorded.workspace_id === job.workspace_id &&
      recorded.status === "succeeded" &&
      recorded.external_post_id === externalPostId
    )
      return { id: job.id, status: "succeeded", externalPostId };
    if (error) console.error(`[scheduler] fail_scheduler_job rpc error:`, error.message);
    return { id: job.id, status: "failed", error: message };
  }
}

export async function runSchedulerTick(
  opts: {
    limit?: number;
    lockSeconds?: number;
    workspaceId?: string;
  } = {},
): Promise<DispatchSummary> {
  const limit = opts.limit ?? 10;
  const lockSeconds = opts.lockSeconds ?? 60;

  const args = { _limit: limit, _lock_seconds: lockSeconds };
  const { data: claimed, error } = opts.workspaceId
    ? await supabaseAdmin.rpc("claim_workspace_scheduler_jobs", {
        ...args,
        _workspace_id: opts.workspaceId,
      })
    : await supabaseAdmin.rpc("claim_scheduler_jobs", args);
  if (error) throw new Error(`claim_scheduler_jobs: ${error.message}`);

  if (!Array.isArray(claimed))
    throw new Error("Scheduler claim did not return a confirmed job set");
  const jobs = claimed as SchedulerJobRow[];
  if (opts.workspaceId && jobs.some((job) => job.workspace_id !== opts.workspaceId)) {
    throw new Error("Scoped scheduler claim returned a different workspace; dispatch stopped");
  }
  if (jobs.length === 0) {
    return { claimed: 0, succeeded: 0, failed: 0, jobs: [] };
  }

  const results = await Promise.all(jobs.map(processOne));
  return {
    claimed: jobs.length,
    succeeded: results.filter((r) => r.status === "succeeded").length,
    failed: results.filter((r) => r.status === "failed").length,
    jobs: results,
  };
}
