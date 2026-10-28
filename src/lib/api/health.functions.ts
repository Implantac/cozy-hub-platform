/**
 * Health module — façade over USE Brain.
 * Derives 5 health categories from the Brain snapshot scores + signals.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSnapshot } from "@/lib/brain/brain";
import { throwIfError } from "./_supabase";

const wsInput = z.object({ workspaceId: z.string().uuid() });
type Category = "marketing" | "content" | "brand" | "channel" | "growth";

export const computeHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const snap = await buildSnapshot(supabase, data.workspaceId, userId);
    const s = snap.scores;
    const negatives = snap.signals.filter((x) => x.kind === "negative");
    const positives = snap.signals.filter((x) => x.kind === "positive");

    const byEngine = (engine: string, kind: "neg" | "pos") =>
      (kind === "neg" ? negatives : positives)
        .filter((sig) => sig.engine === engine)
        .map((sig) => sig.message);

    const cards: Array<{
      category: Category;
      score: number;
      strengths: string[];
      weaknesses: string[];
    }> = [
      {
        category: "marketing",
        score: Math.round((s.presence + s.channel_setup) / 2),
        strengths: byEngine("business", "pos"),
        weaknesses: byEngine("business", "neg"),
      },
      {
        category: "content",
        score: Math.round((s.content + s.consistency) / 2),
        strengths: byEngine("growth", "pos"),
        weaknesses: byEngine("growth", "neg"),
      },
      {
        category: "brand",
        score: s.branding,
        strengths: s.branding >= 70 ? ["Identidade visual sólida"] : [],
        weaknesses: s.branding < 40 ? ["Marca incompleta (voz, paleta ou logo)"] : [],
      },
      {
        category: "channel",
        score: s.channel_setup,
        strengths: s.channel_setup === 100 ? ["Todos os canais conectados"] : [],
        weaknesses: s.channel_setup < 60 ? ["Há canais desconectados"] : [],
      },
      {
        category: "growth",
        score: s.growth,
        strengths: s.growth >= 70 ? ["Publicações automatizadas funcionando"] : [],
        weaknesses: s.growth < 30 ? ["Baixa taxa de sucesso nas publicações"] : [],
      },
    ];

    const { data: rows, error } = await supabase
      .from("health_metrics")
      .insert(
        cards.map((c) => ({
          workspace_id: data.workspaceId,
          category: c.category,
          score: c.score,
          strengths: c.strengths,
          weaknesses: c.weaknesses,
        })),
      )
      .select();
    throwIfError(error);
    return rows ?? [];
  });

export const getLatestHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const cats: Category[] = ["marketing", "content", "brand", "channel", "growth"];
    const results = await Promise.all(
      cats.map(async (cat) => {
        const { data: r } = await supabase
          .from("health_metrics")
          .select("*")
          .eq("workspace_id", data.workspaceId)
          .eq("category", cat)
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return r;
      }),
    );
    return results.filter(Boolean);
  });
