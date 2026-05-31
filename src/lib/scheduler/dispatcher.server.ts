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
import {
  publishToPlatform,
  PublisherError,
  type Platform,
} from "./publishers.server";

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
  const [{ data: content, error: cErr }, { data: channel, error: chErr }] =
    await Promise.all([
      supabaseAdmin
        .from("content")
        .select("id, workspace_id, title, body, media_urls, type")
        .eq("id", job.content_id)
        .single(),
      supabaseAdmin
        .from("channels")
        .select("id, workspace_id, platform, config")
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
  return { content, channel };
}

async function processOne(job: SchedulerJobRow): Promise<DispatchSummary["jobs"][number]> {
  try {
    const { content, channel } = await loadContext(job);
    const platform = channel.platform as Platform;

    const result = await publishToPlatform({
      jobId: job.id,
      workspaceId: job.workspace_id,
      channelId: job.channel_id,
      contentId: job.content_id,
      platform,
      payload: {
        title: content.title,
        body: content.body,
        media_urls: (content.media_urls as string[] | null) ?? [],
      },
      channelConfig: (channel.config as Record<string, unknown> | null) ?? {},
    });

    const { error } = await supabaseAdmin.rpc("complete_scheduler_job", {
      _job_id: job.id,
      _external_post_id: result.externalPostId,
    });
    if (error) throw new Error(error.message);

    return { id: job.id, status: "succeeded", externalPostId: result.externalPostId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scheduler] job ${job.id} failed:`, message);
    const { error } = await supabaseAdmin.rpc("fail_scheduler_job", {
      _job_id: job.id,
      _error: message.slice(0, 1000),
    });
    if (error) console.error(`[scheduler] fail_scheduler_job rpc error:`, error.message);
    return { id: job.id, status: "failed", error: message };
  }
}

export async function runSchedulerTick(opts: {
  limit?: number;
  lockSeconds?: number;
} = {}): Promise<DispatchSummary> {
  const limit = opts.limit ?? 10;
  const lockSeconds = opts.lockSeconds ?? 60;

  const { data: claimed, error } = await supabaseAdmin.rpc("claim_scheduler_jobs", {
    _limit: limit,
    _lock_seconds: lockSeconds,
  });
  if (error) throw new Error(`claim_scheduler_jobs: ${error.message}`);

  const jobs = (claimed ?? []) as SchedulerJobRow[];
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
