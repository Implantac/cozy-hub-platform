import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listBrands = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("brands").select("*").eq("workspace_id", data.workspaceId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspaceId: z.string().uuid(),
      name: z.string().min(2).max(80),
      description: z.string().max(2000).optional(),
      voice: z.record(z.string(), z.unknown()).optional(),
      palette: z.record(z.string(), z.unknown()).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("brands").insert({
      workspace_id: data.workspaceId,
      name: data.name,
      description: data.description ?? null,
      voice: (data.voice ?? {}) as never,
      palette: (data.palette ?? {}) as never,
      created_by: userId,
    }).select().single();
    if (error) throw new Error(error.message);
    await supabase.from("domain_events").insert({
      workspace_id: data.workspaceId, event_type: "BrandCreated",
      payload: { brand_id: row.id, name: row.name },
    });
    return row;
  });

export const deleteBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("brands").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
