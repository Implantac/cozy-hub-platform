/**
 * VELT — Growth Intelligence server functions.
 *
 * Exposes the pure engines in `src/lib/growth/*` to the UI, enriched with the
 * workspace's own data. The key advantage over market tools: best-time-to-post
 * is derived from THIS account's measured engagement (analytics_snapshots), not
 * from a cross-account average.
 */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";
import { adReadiness, preflight, suggestHooks } from "@/lib/growth/post-quality";
import {
  cadenceTarget,
  nextBestSlot,
  rankSlots,
  type SlotObservation,
} from "@/lib/growth/scheduling";
import { ALL_PLATFORMS, PUBLISH_ENABLED, rulesFor } from "@/lib/growth/platform-rules";

const PlatformInput = z.enum(ALL_PLATFORMS as [string, ...string[]]);

/** The DB enum only carries the five platforms the product actively supports. */
type SocialPlatform = Database["public"]["Enums"]["social_platform"];

/* ------------------------------------------------------------------ */
/* Preflight                                                           */
/* ------------------------------------------------------------------ */

/**
 * Runs the full preflight for one draft against every target channel.
 * Used by the composer (live, as the user types) and by the scheduler before
 * enqueueing — a blocker here would otherwise become a failed job later.
 */
export const preflightDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        body: z.string().max(20000).default(""),
        title: z.string().max(500).nullish(),
        mediaCount: z.number().int().min(0).max(20).default(0),
        channelIds: z.array(z.string().uuid()).max(20).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Resolve target platforms. With no explicit channels, check every platform
    // the workspace can publish to — the composer previews all of them.
    let platforms: string[] = [];
    if (data.channelIds.length > 0) {
      const { data: rows, error } = await supabase
        .from("channels")
        .select("id, platform, handle")
        .eq("workspace_id", data.workspaceId)
        .in("id", data.channelIds);
      throwIfError(error);
      platforms = (rows ?? []).map((r) => String(r.platform));
    } else {
      const { data: rows, error } = await supabase
        .from("channels")
        .select("platform")
        .eq("workspace_id", data.workspaceId);
      throwIfError(error);
      platforms = [...new Set((rows ?? []).map((r) => String(r.platform)))];
    }
    if (platforms.length === 0) platforms = ["instagram"];

    const results = platforms.map((platform) => {
      const check = preflight({
        body: data.body,
        title: data.title ?? null,
        platform,
        mediaCount: data.mediaCount,
      });
      return {
        ...check,
        platform,
        ad: adReadiness(data.body, platform),
      };
    });

    return {
      channels: results,
      /** Worst-case verdict: publish is only safe if every channel passes. */
      canPublish: results.every((r) => r.passed),
      blockerCount: results.reduce((a, r) => a + r.blockers.length, 0),
      warningCount: results.reduce((a, r) => a + r.warnings.length, 0),
    };
  });

/* ------------------------------------------------------------------ */
/* Hook suggestions                                                    */
/* ------------------------------------------------------------------ */

export const suggestPostHooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        body: z.string().max(20000),
        platform: PlatformInput.default("instagram"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => suggestHooks(data.body, String(data.platform)));

/* ------------------------------------------------------------------ */
/* Best time to post                                                   */
/* ------------------------------------------------------------------ */

/**
 * Builds slot observations from the workspace's own publication history:
 * succeeded jobs give the timestamp, analytics_snapshots give the result.
 */
async function loadObservations(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  platform: SocialPlatform,
): Promise<{ observations: SlotObservation[]; platform: SocialPlatform; usedFallback: boolean }> {
  // Channels for this platform.
  const { data: channels, error: chErr } = await supabase
    .from("channels")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("platform", platform);
  throwIfError(chErr);

  const channelIds = (channels ?? []).map((c) => c.id);
  if (channelIds.length === 0) {
    return { observations: [], platform, usedFallback: true };
  }

  const { data: jobs, error: jErr } = await supabase
    .from("scheduler_jobs")
    .select("content_id, scheduled_at, status")
    .eq("workspace_id", workspaceId)
    .eq("status", "succeeded")
    .in("channel_id", channelIds)
    .order("scheduled_at", { ascending: false })
    .limit(300);
  throwIfError(jErr);
  if (!jobs || jobs.length === 0) {
    return { observations: [], platform, usedFallback: true };
  }

  const contentIds = [...new Set(jobs.map((j) => j.content_id).filter(Boolean))];
  const { data: snaps, error: sErr } = await supabase
    .from("analytics_snapshots")
    .select("content_id, metrics, captured_at")
    .eq("workspace_id", workspaceId)
    .in("content_id", contentIds)
    .order("captured_at", { ascending: false });
  throwIfError(sErr);

  // Keep the most recent snapshot per content.
  const latest = new Map<string, { engagement: number; impressions: number }>();
  for (const s of snaps ?? []) {
    if (!s.content_id || latest.has(s.content_id)) continue;
    const m = (s.metrics ?? {}) as Record<string, unknown>;
    latest.set(s.content_id, {
      engagement: Number(m.engagement ?? 0),
      impressions: Number(m.impressions ?? m.reach ?? 0),
    });
  }

  const observations: SlotObservation[] = [];
  for (const j of jobs) {
    if (!j.scheduled_at) continue;
    const metric = j.content_id ? latest.get(j.content_id) : undefined;
    if (!metric) continue;
    observations.push({
      publishedAt: j.scheduled_at,
      engagement: metric.engagement,
      impressions: metric.impressions || undefined,
    });
  }

  return { observations, platform, usedFallback: observations.length === 0 };
}

export const getBestTimeToPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        platform: PlatformInput.default("instagram"),
        /** ISO instant to compute from. Defaults to now. */
        from: z.string().datetime().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { observations, usedFallback } = await loadObservations(
      supabase,
      data.workspaceId,
      data.platform as SocialPlatform,
    );

    const from = data.from ? new Date(data.from) : new Date();
    const best = nextBestSlot(String(data.platform), observations, from);
    const ranked = rankSlots(String(data.platform), observations).slice(0, 6);
    const { data: profile } = await supabase
      .from("user_profile_digital")
      .select("time_budget_hours_week, experience_level")
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      platform: String(data.platform),
      best,
      topSlots: ranked,
      /** True when no personalised data existed — the UI must say so. */
      usedFallback,
      observationsCount: observations.length,
      cadence: cadenceTarget(String(data.platform), profile),
    };
  });

/* ------------------------------------------------------------------ */
/* Platform reference                                                  */
/* ------------------------------------------------------------------ */

/** Static reference used to render the composer's platform checklist. */
export const getPlatformRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ platform: PlatformInput.default("instagram") }).parse(input),
  )
  .handler(async ({ data }) => {
    const rules = rulesFor(String(data.platform));
    return {
      rules,
      publishEnabled: PUBLISH_ENABLED.has(String(data.platform) as never),
    };
  });

/* ------------------------------------------------------------------ */
/* Publishing capability (honesty surface)                             */
/* ------------------------------------------------------------------ */

/**
 * Reports, per platform, whether automated publishing is genuinely wired and
 * whether the OAuth credentials exist in this environment.
 *
 * This endpoint exists to keep the UI honest: the scheduler and the channel
 * screen use it to disable "agendar" on platforms that would fail, instead of
 * letting the user discover it through a dead-letter job hours later.
 */
export const getPublishCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { publisherCapabilities } = await import("@/lib/scheduler/publishers.server");
    const caps = publisherCapabilities();
    return {
      platforms: caps,
      /** True when running with simulated publishers (local dev/demo). */
      simulated: process.env.VELT_PUBLISHER_MODE === "simulate",
      readyCount: caps.filter((c) => c.implemented && c.credentialsReady).length,
    };
  });

/* ------------------------------------------------------------------ */
/* AI coach (rewrites verified by the deterministic engine)            */
/* ------------------------------------------------------------------ */

/**
 * In-memory throttle. Deliberately simple and per-process: this endpoint burns
 * model tokens, and the realistic abuse case is a client stuck in a retry loop
 * (network flakiness, a React effect without a guard), not a distributed attack.
 * A shared limiter would need Redis; pretending this is one would be worse than
 * saying what it is.
 *
 * Reset on cold start is acceptable: the worst case is one extra model call.
 */
const COACH_WINDOW_MS = 60_000;
const COACH_MAX_PER_WINDOW = 8;
const coachHits = new Map<string, number[]>();

function throttleCoach(userId: string): { ok: true } | { ok: false; retryIn: number } {
  const now = Date.now();
  const hits = (coachHits.get(userId) ?? []).filter((t) => now - t < COACH_WINDOW_MS);
  if (hits.length >= COACH_MAX_PER_WINDOW) {
    const oldest = hits[0];
    return { ok: false, retryIn: Math.ceil((COACH_WINDOW_MS - (now - oldest)) / 1000) };
  }
  hits.push(now);
  coachHits.set(userId, hits);
  // Opportunistic cleanup so the map does not grow with every user forever.
  if (coachHits.size > 500) {
    for (const [k, v] of coachHits) {
      if (v.every((t) => now - t >= COACH_WINDOW_MS)) coachHits.delete(k);
    }
  }
  return { ok: true };
}

export const coachDraftWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        body: z.string().max(20000),
        platform: PlatformInput.default("instagram"),
        title: z.string().max(500).nullish(),
        mediaCount: z.number().int().min(0).max(20).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // A draft too short to diagnose costs a model call and returns nothing.
    if (data.body.trim().length < 20) {
      return {
        source: "unavailable" as const,
        suggestions: [],
        issueIds: [],
        skippedReason: "all_rejected" as const,
      };
    }

    const gate = throttleCoach(userId);
    if (!gate.ok) {
      return {
        source: "unavailable" as const,
        suggestions: [],
        issueIds: [],
        skippedReason: "model_failed" as const,
        retryInSeconds: gate.retryIn,
      };
    }

    // Brand voice makes the rewrite sound like the business instead of like a
    // model. Fetched narrowly: only the newest brand's voice block.
    const { data: brand } = await supabase
      .from("brands")
      .select("name, voice")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { coachDraft } = await import("@/lib/growth/coach.server");
    return coachDraft({
      body: data.body,
      platform: String(data.platform),
      title: data.title ?? null,
      mediaCount: data.mediaCount,
      brandVoice: (brand?.voice ?? null) as Record<string, unknown> | null,
    });
  });
