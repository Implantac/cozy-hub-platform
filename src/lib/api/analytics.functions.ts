import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";

/**
 * Aggregated analytics overview for a workspace.
 * Returns daily series + per-platform breakdown + totals from analytics_snapshots.
 */
export const getAnalyticsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        days: z.number().int().min(7).max(180).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    const { data: rows, error } = await supabase
      .from("analytics_snapshots")
      .select("captured_at, metrics, channel:channels(platform)")
      .eq("workspace_id", data.workspaceId)
      .gte("captured_at", since)
      .order("captured_at", { ascending: true })
      .limit(1000);

    throwIfError(error);

    const daily = new Map<
      string,
      { date: string; impressions: number; engagement: number; reach: number }
    >();
    const byPlatform = new Map<
      string,
      { platform: string; impressions: number; engagement: number }
    >();
    const totals = { impressions: 0, engagement: 0, reach: 0, posts: 0 };

    for (const r of rows ?? []) {
      const m = (r.metrics ?? {}) as Record<string, unknown>;
      const imp = Number(m.impressions ?? 0);
      const eng = Number(m.engagement ?? 0);
      const reach = Number(m.reach ?? 0);
      const day = (r.captured_at as string).slice(0, 10);

      const d = daily.get(day) ?? { date: day, impressions: 0, engagement: 0, reach: 0 };
      d.impressions += imp;
      d.engagement += eng;
      d.reach += reach;
      daily.set(day, d);

      const platform = (r.channel as { platform: string } | null)?.platform ?? "other";
      const p = byPlatform.get(platform) ?? { platform, impressions: 0, engagement: 0 };
      p.impressions += imp;
      p.engagement += eng;
      byPlatform.set(platform, p);

      totals.impressions += imp;
      totals.engagement += eng;
      totals.reach += reach;
      totals.posts += 1;
    }

    return {
      totals,
      daily: Array.from(daily.values()),
      byPlatform: Array.from(byPlatform.values()),
    };
  });
