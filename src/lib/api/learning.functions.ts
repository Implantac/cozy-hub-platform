import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";

export const listLearningPaths = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.from("learning_paths").select("*").order("difficulty");
    throwIfError(error);
    return data ?? [];
  });

export const listMyProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("learning_path_progress")
      .select("*").eq("user_id", userId);
    throwIfError(error);
    return data ?? [];
  });

export const toggleMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    pathId: z.string().uuid(),
    milestoneId: z.string().min(1).max(80),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: path, error: pErr } = await supabase.from("learning_paths")
      .select("milestones").eq("id", data.pathId).maybeSingle();
    if (pErr || !path) throw new Error(pErr?.message ?? "Trilha não encontrada");
    const total = Array.isArray(path.milestones) ? path.milestones.length : 0;

    const { data: existing } = await supabase.from("learning_path_progress")
      .select("*").eq("user_id", userId).eq("path_id", data.pathId).maybeSingle();

    const current = new Set<string>(existing?.completed_milestones ?? []);
    if (current.has(data.milestoneId)) current.delete(data.milestoneId);
    else current.add(data.milestoneId);
    const completed = Array.from(current);
    const pct = total ? Math.round((completed.length / total) * 100) : 0;

    const payload = {
      user_id: userId, path_id: data.pathId,
      completed_milestones: completed, progress_pct: pct,
      completed_at: pct === 100 ? new Date().toISOString() : null,
    };
    const { data: row, error } = await supabase.from("learning_path_progress")
      .upsert(payload, { onConflict: "user_id,path_id" }).select().single();
    throwIfError(error);
    return row;
  });
