import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  publisherCapabilities,
  preflightOrThrow,
  type Platform,
} from "@/lib/scheduler/publishers.server";
import { contentMediaUrls } from "@/lib/content/media";
import { readAllPages } from "./_pagination";
import { runSchedulerTick } from "@/lib/scheduler/dispatcher.server";
import { throwIfError } from "./_supabase";
import { requireWorkspaceRole } from "./_workspace";
import { WORKSPACE_EDIT_ROLES, WORKSPACE_MANAGE_ROLES } from "@/lib/workspace/permissions";

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
        channelIds: z
          .array(z.string().uuid())
          .min(1)
          .max(20)
          .refine((ids) => new Set(ids).size === ids.length, "Selecione canais distintos."),
        scheduledAt: z.string().datetime(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (Date.parse(data.scheduledAt) <= Date.now())
      throw new Error("Escolha um horário futuro para o agendamento.");
    const { data: content, error: contentError } = await supabase
      .from("content")
      .select("id, workspace_id, title, body, media")
      .eq("id", data.contentId)
      .maybeSingle();
    throwIfError(contentError);
    if (!content) throw new Error("Conteúdo não encontrado neste workspace.");
    await requireWorkspaceRole(supabase, content.workspace_id, userId, WORKSPACE_EDIT_ROLES);
    const { data: channels, error: channelError } = await supabase
      .from("channels")
      .select("id, platform, status, metadata, external_id")
      .in("id", data.channelIds)
      .eq("workspace_id", content.workspace_id);
    throwIfError(channelError);
    if (!channels || channels.length !== data.channelIds.length)
      throw new Error("Selecione apenas canais deste workspace.");
    const capabilities = publisherCapabilities();
    for (const channel of channels) {
      const capability = capabilities.find((c) => c.platform === channel.platform);
      if (channel.status !== "connected")
        throw new Error("Conecte todos os canais antes de agendar.");
      if (
        channel.platform === "google_business" &&
        (channel.metadata as Record<string, unknown> | null)?.location_confirmed !== true
      )
        throw new Error(
          "Selecione e confirme a unidade do Google Business em Canais antes de agendar.",
        );
      if (!capability?.implemented || !capability.credentialsReady)
        throw new Error("Publicação não configurada para um dos canais selecionados.");
      preflightOrThrow({
        jobId: "preflight",
        workspaceId: content.workspace_id,
        contentId: content.id,
        channelId: channel.id,
        platform: channel.platform as Platform,
        channelConfig: {
          ...(channel.metadata as Record<string, unknown> | null),
          external_id: channel.external_id,
        },
        payload: {
          title: content.title,
          body: content.body,
          media_urls: contentMediaUrls(content.media),
        },
      });
    }
    const { data: jobs, error } = await supabase.rpc("enqueue_publication", {
      _content_id: data.contentId,
      _channel_ids: data.channelIds,
      _scheduled_at: data.scheduledAt,
    });
    throwIfError(error);
    if (
      !jobs ||
      jobs.length !== data.channelIds.length ||
      new Set(jobs.map((job) => job.channel_id)).size !== data.channelIds.length ||
      jobs.some(
        (job) =>
          job.content_id !== data.contentId ||
          !data.channelIds.includes(job.channel_id) ||
          job.status !== "pending",
      )
    )
      throw new Error("Agendamento não confirmado integralmente.");
    return jobs;
  });

export const listSchedulerJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        status: z
          .enum(["pending", "processing", "succeeded", "failed", "dead_letter", "cancelled"])
          .optional(),
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
    const { supabase, userId } = context;
    await requireWorkspaceRole(supabase, data.workspaceId, userId, WORKSPACE_EDIT_ROLES);
    const { data: row, error } = await supabase.rpc("cancel_publication", {
      _workspace_id: data.workspaceId,
      _job_id: data.jobId,
    });
    throwIfError(error);
    if (!row || row.status !== "cancelled") throw new Error("Cancelamento não confirmado.");
    return row;
  });

/**
 * Manual tick — runs the dispatcher on demand.
 * Gated to workspace owners/admins to avoid letting any signed-in user
 * trigger publication of jobs they don't own.
 *
 * The service-role claim is scoped to this exact workspace; only cron claims globally.
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
    await requireWorkspaceRole(supabase, data.workspaceId, userId, WORKSPACE_MANAGE_ROLES);
    return runSchedulerTick({ limit: data.limit, workspaceId: data.workspaceId });
  });

/** Complete queue read for the workspace screen: status counts are not counts of a truncated/filter-only page. */
export const getSchedulerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireWorkspaceRole(context.supabase, data.workspaceId, context.userId);
    return readAllPages((from, to) =>
      context.supabase
        .from("scheduler_jobs")
        .select("*, content:content(title,type), channel:channels(platform,handle)")
        .eq("workspace_id", data.workspaceId)
        .order("scheduled_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    );
  });

/** Readiness is configuration + channel state, not a certification of the provider's OAuth grant. */
export const getSchedulingOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireWorkspaceRole(supabase, data.workspaceId, userId);
    const [contents, channels] = await Promise.all([
      readAllPages((from, to) =>
        supabase
          .from("content")
          .select("id,title,status")
          .eq("workspace_id", data.workspaceId)
          .in("status", ["draft", "failed"])
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      ),
      readAllPages((from, to) =>
        supabase
          .from("channels")
          .select("id,platform,handle,status,metadata")
          .eq("workspace_id", data.workspaceId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ]);
    const caps = publisherCapabilities();
    return {
      contents,
      channels: channels.map((channel) => {
        const capability = caps.find((c) => c.platform === channel.platform);
        const reason =
          channel.status !== "connected"
            ? "oauth"
            : channel.platform === "tiktok" &&
                (channel.metadata as Record<string, unknown> | null)?.posting_mode === "inbox"
              ? "direct_post"
              : channel.platform === "google_business" &&
                  (channel.metadata as Record<string, unknown> | null)?.location_confirmed !== true
                ? "location"
                : !capability?.implemented
                  ? "unsupported"
                  : !capability.credentialsReady
                    ? "environment"
                    : "ready";
        return {
          id: channel.id,
          platform: channel.platform,
          handle: channel.handle,
          status: channel.status,
          eligible: reason === "ready",
          reason,
        };
      }),
    };
  });
