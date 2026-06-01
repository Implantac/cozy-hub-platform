import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listOpportunities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspaceId: z.string().uuid().optional(),
    status: z.enum(["exploding","growing","stable","saturated","declining"]).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("opportunities").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.workspaceId) q = q.or(`workspace_id.is.null,workspace_id.eq.${data.workspaceId}`);
    else q = q.is("workspace_id", null);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
