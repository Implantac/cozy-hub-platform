import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";

const wsInput = z.object({ workspaceId: z.string().uuid() });

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)));
}

export const computeDigitalScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const ws = data.workspaceId;
    const [brands, channels, content, jobs, missions] = await Promise.all([
      supabase.from("brands").select("id, voice, palette, logo_url", { count: "exact" }).eq("workspace_id", ws),
      supabase.from("channels").select("id, status, handle, brand_id", { count: "exact" }).eq("workspace_id", ws),
      supabase.from("content").select("id, status, created_at, body", { count: "exact" }).eq("workspace_id", ws),
      supabase.from("scheduler_jobs").select("id, status, scheduled_at", { count: "exact" }).eq("workspace_id", ws),
      supabase.from("missions").select("id, status", { count: "exact" }).eq("workspace_id", ws),
    ]);

    const brandRows = brands.data ?? [];
    const channelRows = channels.data ?? [];
    const contentRows = content.data ?? [];
    const jobRows = jobs.data ?? [];

    // Presence: at least 1 brand + at least 2 channels
    const presence = Math.round(
      (Math.min(brandRows.length, 1) * 40) + (Math.min(channelRows.length, 3) / 3) * 60,
    );

    // Branding: brand has voice + palette + logo
    const branding = brandRows.length === 0 ? 0 : Math.round(
      brandRows.reduce((sum, b: any) => {
        const v = b.voice && Object.keys(b.voice).length ? 35 : 0;
        const p = b.palette && Object.keys(b.palette).length ? 35 : 0;
        const l = b.logo_url ? 30 : 0;
        return sum + v + p + l;
      }, 0) / brandRows.length,
    );

    // Content: volume + diversity
    const contentScore = Math.min(100, contentRows.length * 8);

    // Consistency: published in last 30 days
    const cutoff = Date.now() - 30 * 86400_000;
    const recent = contentRows.filter((c: any) => new Date(c.created_at).getTime() > cutoff).length;
    const consistency = Math.min(100, recent * 12);

    // Growth: succeeded jobs ratio
    const succ = jobRows.filter((j: any) => j.status === "succeeded").length;
    const growth = pct(succ, Math.max(jobRows.length, 1));

    // Channel setup: connected ratio
    const connected = channelRows.filter((c: any) => c.status === "connected").length;
    const channel_setup = pct(connected, Math.max(channelRows.length, 1));

    const overall = Math.round(
      presence * 0.18 + branding * 0.17 + contentScore * 0.20 +
      consistency * 0.18 + growth * 0.14 + channel_setup * 0.13,
    );

    const breakdown = {
      counts: {
        brands: brandRows.length,
        channels: channelRows.length,
        connectedChannels: connected,
        content: contentRows.length,
        recentContent: recent,
        publishedJobs: succ,
      },
      gaps: [
        brandRows.length === 0 && "Criar sua primeira marca",
        channelRows.length < 2 && "Conectar pelo menos 2 canais",
        contentRows.length < 5 && "Publicar 5 conteúdos iniciais",
        recent < 4 && "Postar pelo menos 4 vezes nos últimos 30 dias",
        connected < channelRows.length && "Reconectar canais desconectados",
      ].filter(Boolean),
    };

    const { data: row, error } = await supabase.from("digital_scores").insert({
      workspace_id: ws, overall, presence, branding, content: contentScore,
      consistency, growth, channel_setup, breakdown,
    }).select().single();
    throwIfError(error);
    return row;
  });

export const getLatestScore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("digital_scores").select("*").eq("workspace_id", data.workspaceId)
      .order("computed_at", { ascending: false }).limit(1).maybeSingle();
    throwIfError(error);
    return row;
  });
