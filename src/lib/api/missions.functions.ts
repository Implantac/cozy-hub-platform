import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";

export const listMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("missions").select("*").eq("workspace_id", data.workspaceId)
      .order("status").order("priority", { ascending: false });
    throwIfError(error);
    return rows ?? [];
  });

export const createMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspaceId: z.string().uuid(),
      title: z.string().min(2).max(160),
      description: z.string().max(2000).optional(),
      priority: z.number().int().min(0).max(10).default(0),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = unwrap(await supabase.from("missions").insert({
      workspace_id: data.workspaceId,
      title: data.title,
      description: data.description ?? null,
      priority: data.priority,
      created_by: userId,
    }).select().single());
    await supabase.from("domain_events").insert({
      workspace_id: data.workspaceId, event_type: "MissionAssigned",
      payload: { mission_id: row.id, title: row.title },
    });
    return row;
  });

export const updateMissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspaceId: z.string().uuid(),
      id: z.string().uuid(),
      status: z.enum(["pending", "in_progress", "done", "dismissed"]),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("missions")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    throwIfError(error);
    return { ok: true };
  });
