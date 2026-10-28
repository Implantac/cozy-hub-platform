import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const ws = data.workspaceId;
    const [brands, channels, content, jobs, recs, missions, events] = await Promise.all([
      supabase.from("brands").select("id", { count: "exact", head: true }).eq("workspace_id", ws),
      supabase
        .from("channels")
        .select("id, platform, status", { count: "exact" })
        .eq("workspace_id", ws),
      supabase.from("content").select("id, status").eq("workspace_id", ws),
      supabase
        .from("scheduler_jobs")
        .select("id, status, scheduled_at")
        .eq("workspace_id", ws)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at")
        .limit(5),
      supabase
        .from("brain_recommendations")
        .select("*")
        .eq("workspace_id", ws)
        .eq("status", "open")
        .order("score", { ascending: false })
        .limit(3),
      supabase
        .from("missions")
        .select("id, title, status, priority")
        .eq("workspace_id", ws)
        .neq("status", "done")
        .order("priority", { ascending: false })
        .limit(5),
      supabase
        .from("domain_events")
        .select("id, event_type, payload, created_at")
        .eq("workspace_id", ws)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const contentByStatus = (content.data ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      counts: {
        brands: brands.count ?? 0,
        channels: channels.count ?? 0,
        channelsConnected: (channels.data ?? []).filter((c: any) => c.status === "connected")
          .length,
        content: content.data?.length ?? 0,
      },
      contentByStatus,
      upcomingJobs: jobs.data ?? [],
      recommendations: recs.data ?? [],
      missions: missions.data ?? [],
      events: events.data ?? [],
    };
  });
