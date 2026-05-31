import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getProvider, listProviders } from "@/lib/oauth/providers.server";
import { signState } from "@/lib/oauth/state.server";
import { deleteToken } from "@/lib/oauth/store.server";

/**
 * Returns the URL the user must visit to authorize the connection.
 * The caller is responsible for navigating window.location to it.
 */
export const startOAuthConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspaceId: z.string().uuid(),
      provider: z.string().min(2).max(40),
      redirectUri: z.string().url(),
      brandId: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Workspace membership check (RLS-backed)
    const { data: member, error } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member || !["owner", "admin", "editor"].includes(member.role)) {
      throw new Error("forbidden: insufficient role to connect channels");
    }

    const provider = getProvider(data.provider);
    const state = signState({
      workspaceId: data.workspaceId,
      userId,
      provider: data.provider,
      brandId: data.brandId ?? null,
      redirectUri: data.redirectUri,
    });
    const url = provider.authUrl({ state, redirectUri: data.redirectUri });
    return { url, state };
  });

export const listOAuthProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { providers: listProviders() };
  });

export const disconnectChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ channelId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Membership/role checked via RLS on channels.update
    const { data: row, error } = await supabase
      .from("channels")
      .update({ status: "disconnected" })
      .eq("id", data.channelId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await deleteToken(data.channelId);
    return row;
  });
