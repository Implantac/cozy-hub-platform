/**
 * Score module — now a thin façade over the USE Brain.
 * `computeDigitalScore` delegates to the Brain orchestrator, which persists
 * both `brain_snapshots` and mirrors into `digital_scores` for back-compat.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSnapshot } from "@/lib/brain/brain";
import { throwIfError } from "./_supabase";
import type { Json } from "./_types";

const wsInput = z.object({ workspaceId: z.string().uuid() });

export const computeDigitalScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const snap = await buildSnapshot(supabase, data.workspaceId, userId);

    // Persist the consolidated snapshot
    await supabase.from("brain_snapshots").insert({
      workspace_id: snap.workspace_id,
      snapshot: snap.snapshot as unknown as Json,
      scores: snap.scores as unknown as Json,
      signals: snap.signals as unknown as Json,
    });

    // Mirror into digital_scores (Score module read model)
    const { data: row, error } = await supabase.from("digital_scores").insert({
      workspace_id: data.workspaceId,
      overall: snap.scores.overall,
      presence: snap.scores.presence,
      branding: snap.scores.branding,
      content: snap.scores.content,
      consistency: snap.scores.consistency,
      growth: snap.scores.growth,
      channel_setup: snap.scores.channel_setup,
      breakdown: {
        gaps: snap.signals
          .filter((s) => s.kind === "negative")
          .map((s) => s.message)
          .slice(0, 6),
      },
    }).select().single();
    throwIfError(error);

    // Invalidate cached Brain answers since scores changed
    await supabase.from("brain_answers").delete().eq("workspace_id", data.workspaceId);

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
