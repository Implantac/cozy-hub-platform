import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError, unwrap } from "./_supabase";
import { assertBrandInWorkspace, requireWorkspaceRole } from "./_workspace";
import { WORKSPACE_MANAGE_ROLES } from "@/lib/workspace/permissions";

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
    z
      .object({
        workspaceId: z.string().uuid(),
        brandId: z.string().uuid().optional(),
        platform: PlatformSchema,
        handle: z.string().trim().min(1).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireWorkspaceRole(supabase, data.workspaceId, userId, WORKSPACE_MANAGE_ROLES);
    await assertBrandInWorkspace(supabase, data.workspaceId, data.brandId);
    const row = unwrap(
      await supabase
        .from("channels")
        .insert({
          workspace_id: data.workspaceId,
          brand_id: data.brandId ?? null,
          platform: data.platform,
          handle: data.handle,
          status: "disconnected",
        })
        .select()
        .single(),
    );
    await supabase.from("domain_events").insert({
      workspace_id: data.workspaceId,
      event_type: "ChannelRegistered",
      payload: { channel_id: row.id, platform: row.platform },
    });
    return row;
  });

export const deleteChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireWorkspaceRole(supabase, data.workspaceId, userId, WORKSPACE_MANAGE_ROLES);
    const { data: row, error } = await supabase
      .from("channels")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId)
      .select("id")
      .maybeSingle();
    throwIfError(error);
    if (!row) throw new Error("Canal não encontrado neste workspace ou exclusão não permitida.");
    return { ok: true, id: row.id };
  });
