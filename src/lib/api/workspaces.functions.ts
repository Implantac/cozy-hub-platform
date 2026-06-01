import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "workspace";

type WorkspaceMembershipRow = {
  role: string;
  workspace: { id: string; slug: string; name: string; plan: string; created_at: string } | null;
};

export const listMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("workspace_members")
      .select("role, workspace:workspaces(id, slug, name, plan, created_at)")
      .eq("user_id", userId);
    throwIfError(error);
    return ((data ?? []) as unknown as WorkspaceMembershipRow[])
      .filter((m) => !!m.workspace)
      .map((m) => ({ ...m.workspace!, role: m.role }));
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
    const ws = unwrap(await supabase
      .from("workspaces")
      .insert({ name: data.name, slug, owner_id: userId })
      .select()
      .single());

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
    throwIfError(error);
    return data;
  });

export const setDefaultWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Reject silently-stale defaults: the user MUST be a member of the target workspace.
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!member) throw new Error("forbidden: not a member of this workspace");

    const { error } = await supabase.from("profiles").update({ default_workspace_id: data.workspaceId }).eq("id", userId);
    throwIfError(error);
    return { ok: true };
  });

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ws, error } = await supabase.from("workspaces").select("*").eq("id", data.id).maybeSingle();
    throwIfError(error);
    if (!ws) throw new Error("Workspace not found");
    const { data: members } = await supabase
      .from("workspace_members")
      .select("role, user_id, joined_at, profile:profiles(display_name, avatar_url)")
      .eq("workspace_id", data.id);
    return { workspace: ws, members: members ?? [] };
  });
