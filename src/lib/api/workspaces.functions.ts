import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "workspace";

export const listMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("workspace_members")
      .select("role, workspace:workspaces(id, slug, name, plan, created_at)")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((m: any) => ({ ...m.workspace, role: m.role }));
  });

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      name: z.string().min(2).max(80),
      slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const slug = data.slug ?? `${slugify(data.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: ws, error } = await supabase
      .from("workspaces")
      .insert({ name: data.name, slug, owner_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("profiles").update({ default_workspace_id: ws.id, onboarding_completed: true }).eq("id", userId);
    await supabase.from("audit_logs").insert({
      workspace_id: ws.id, actor_id: userId, action: "workspace.created",
      resource_type: "workspace", resource_id: ws.id, metadata: { name: ws.name },
    });
    return ws;
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const setDefaultWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update({ default_workspace_id: data.workspaceId }).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ws, error } = await supabase.from("workspaces").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!ws) throw new Error("Workspace not found");
    const { data: members } = await supabase
      .from("workspace_members")
      .select("role, user_id, joined_at, profile:profiles(display_name, avatar_url)")
      .eq("workspace_id", data.id);
    return { workspace: ws, members: members ?? [] };
  });
