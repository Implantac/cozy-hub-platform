import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const wsInput = z.object({ workspaceId: z.string().uuid() });

type Category = "marketing"|"content"|"brand"|"channel"|"growth";

export const computeHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const ws = data.workspaceId;
    const [brands, channels, content, jobs] = await Promise.all([
      supabase.from("brands").select("id, voice, palette, logo_url").eq("workspace_id", ws),
      supabase.from("channels").select("id, status").eq("workspace_id", ws),
      supabase.from("content").select("id, created_at, status").eq("workspace_id", ws),
      supabase.from("scheduler_jobs").select("id, status").eq("workspace_id", ws),
    ]);

    const brandRows = brands.data ?? [];
    const chRows = channels.data ?? [];
    const ctRows = content.data ?? [];
    const jbRows = jobs.data ?? [];
    const cutoff = Date.now() - 30 * 86400_000;
    const recent = ctRows.filter((c: any) => new Date(c.created_at).getTime() > cutoff).length;
    const connected = chRows.filter((c: any) => c.status === "connected").length;
    const succ = jbRows.filter((j: any) => j.status === "succeeded").length;

    const cards: Array<{
      category: Category; score: number; strengths: string[]; weaknesses: string[];
    }> = [
      {
        category: "marketing",
        score: Math.min(100, (chRows.length * 15) + (ctRows.length * 4)),
        strengths: [
          chRows.length >= 2 ? "Presença multicanal" : "",
          ctRows.length >= 10 ? "Volume de conteúdo saudável" : "",
        ].filter(Boolean),
        weaknesses: [
          chRows.length < 2 ? "Apenas 1 canal ativo" : "",
          ctRows.length < 5 ? "Volume baixo de conteúdo" : "",
        ].filter(Boolean),
      },
      {
        category: "content",
        score: Math.min(100, ctRows.length * 6 + recent * 8),
        strengths: [recent >= 8 ? "Postando consistentemente" : ""].filter(Boolean),
        weaknesses: [recent < 4 ? "Frequência baixa nos últimos 30 dias" : ""].filter(Boolean),
      },
      {
        category: "brand",
        score: brandRows.length === 0 ? 0 : Math.round(
          brandRows.reduce((s, b: any) => {
            return s + (b.voice && Object.keys(b.voice).length ? 35 : 0)
                    + (b.palette && Object.keys(b.palette).length ? 35 : 0)
                    + (b.logo_url ? 30 : 0);
          }, 0) / brandRows.length,
        ),
        strengths: brandRows.length > 0 ? ["Marca cadastrada"] : [],
        weaknesses: [
          brandRows.length === 0 ? "Nenhuma marca cadastrada" : "",
          brandRows.length > 0 && !brandRows.some((b: any) => b.logo_url) ? "Marca sem logo" : "",
        ].filter(Boolean),
      },
      {
        category: "channel",
        score: chRows.length === 0 ? 0 : Math.round((connected / chRows.length) * 100),
        strengths: connected === chRows.length && chRows.length > 0 ? ["Todos os canais conectados"] : [],
        weaknesses: chRows.length - connected > 0 ? [`${chRows.length - connected} canal(is) desconectado(s)`] : [],
      },
      {
        category: "growth",
        score: jbRows.length === 0 ? 20 : Math.round((succ / jbRows.length) * 100),
        strengths: succ > 5 ? ["Publicações automatizadas funcionando"] : [],
        weaknesses: jbRows.length === 0 ? ["Nenhuma publicação agendada"] : [],
      },
    ];

    // Replace by inserting fresh rows (history is preserved by computed_at)
    const { data: rows, error } = await supabase.from("health_metrics").insert(
      cards.map((c) => ({
        workspace_id: ws, category: c.category, score: c.score,
        strengths: c.strengths, weaknesses: c.weaknesses,
      })),
    ).select();
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getLatestHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const cats: Category[] = ["marketing","content","brand","channel","growth"];
    const results = await Promise.all(cats.map(async (cat) => {
      const { data: r } = await supabase.from("health_metrics").select("*")
        .eq("workspace_id", data.workspaceId).eq("category", cat)
        .order("computed_at", { ascending: false }).limit(1).maybeSingle();
      return r;
    }));
    return results.filter(Boolean);
  });
