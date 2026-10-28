import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getProvider, listProviders } from "@/lib/oauth/providers.server";
import { signState } from "@/lib/oauth/state.server";
import { deleteToken } from "@/lib/oauth/store.server";
import { throwIfError } from "./_supabase";

/**
 * Build the OAuth callback URL server-side. Never trust a client-supplied
 * redirect URI — that would rely entirely on the provider's redirect-URI
 * allowlist for safety and widen the attack surface if the provider app
 * is ever loosely configured.
 *
 * Resolution order:
 *   1. process.env.APP_ORIGIN (REQUIRED in production/staging)
 *   2. Incoming request URL origin (local dev only — forwarded proxy
 *      headers are NOT trusted, since they can be forged when no trusted
 *      reverse proxy strips them).
 *
 * If APP_ORIGIN is unset in production, we hard-fail rather than risk
 * embedding an attacker-influenced host into the signed OAuth state.
 */
function buildCallbackUri(provider: string): string {
  const configured = process.env.APP_ORIGIN?.replace(/\/$/, "");
  if (configured) return `${configured}/api/public/oauth/callback/${provider}`;

  const env = process.env.NODE_ENV ?? "development";
  if (env === "production") {
    throw new Error("APP_ORIGIN must be configured in production for OAuth callbacks");
  }

  // Local dev fallback — derive from the request URL only (no forwarded headers).
  const req = getRequest();
  const url = new URL(req.url);
  return `${url.origin}/api/public/oauth/callback/${provider}`;
}

/**
 * Returns the URL the user must visit to authorize the connection.
 * The caller is responsible for navigating window.location to it.
 */
export const startOAuthConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        provider: z
          .string()
          .min(2)
          .max(40)
          .regex(/^[a-z0-9_-]+$/),
        brandId: z.string().uuid().optional(),
      })
      .parse(input),
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
    throwIfError(error);
    if (!member || !["owner", "admin", "editor"].includes(member.role)) {
      throw new Error("forbidden: insufficient role to connect channels");
    }

    const provider = getProvider(data.provider);
    const redirectUri = buildCallbackUri(data.provider);
    const state = signState({
      workspaceId: data.workspaceId,
      userId,
      provider: data.provider,
      brandId: data.brandId ?? null,
      redirectUri,
    });
    const url = provider.authUrl({ state, redirectUri });
    return { url, state };
  });

export const listOAuthProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { providers: listProviders() };
  });

export const disconnectChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ channelId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Membership/role checked via RLS on channels.update
    const { data: row, error } = await supabase
      .from("channels")
      .update({ status: "disconnected" })
      .eq("id", data.channelId)
      .select()
      .single();
    throwIfError(error);
    await deleteToken(data.channelId);
    return row;
  });
