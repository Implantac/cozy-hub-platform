import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";

const PlatformSchema = z.enum(["instagram", "facebook", "youtube", "tiktok", "linkedin"]);

export const listChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("channels")
      .select("*, brand:brands(name)")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false });
    throwIfError(error);
    return rows ?? [];
  });

export const createChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspaceId: z.string().uuid(),
      brandId: z.string().uuid().optional(),
      platform: PlatformSchema,
      handle: z.string().min(1).max(80),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const row = unwrap(await supabase.from("channels").insert({
      workspace_id: data.workspaceId,
      brand_id: data.brandId ?? null,
      platform: data.platform,
      handle: data.handle,
      status: "disconnected",
    }).select().single());
    await supabase.from("domain_events").insert({
      workspace_id: data.workspaceId, event_type: "ChannelRegistered",
      payload: { channel_id: row.id, platform: row.platform },
    });
    return row;
  });

export const deleteChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspaceId: z.string().uuid(),
      id: z.string().uuid(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("channels")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    throwIfError(error);
    return { ok: true };
  });
