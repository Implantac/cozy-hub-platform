import { createServerFn } from "@tanstack/react-start";
import { getRequest, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getProvider, listProviders } from "@/lib/oauth/providers.server";
import {
  signState,
  stateCookieName,
  stateCookieValue,
  STATE_COOKIE_PATH,
  STATE_TTL_SECONDS,
} from "@/lib/oauth/state.server";
import { throwIfError } from "./_supabase";
import { requireWorkspaceRole, assertBrandInWorkspace } from "./_workspace";
import { WORKSPACE_MANAGE_ROLES } from "@/lib/workspace/permissions";

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

    await requireWorkspaceRole(supabase, data.workspaceId, userId, WORKSPACE_MANAGE_ROLES);
    await assertBrandInWorkspace(supabase, data.workspaceId, data.brandId);

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
    setCookie(stateCookieName(data.provider), stateCookieValue(state), {
      httpOnly: true,
      secure: new URL(redirectUri).protocol === "https:",
      sameSite: "lax",
      path: STATE_COOKIE_PATH,
      maxAge: STATE_TTL_SECONDS,
    });
    return { url };
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
    const { supabase, userId } = context;
    const { data: channel, error: readError } = await supabase
      .from("channels")
      .select("id,workspace_id")
      .eq("id", data.channelId)
      .maybeSingle();
    throwIfError(readError);
    if (!channel) throw new Error("Canal não encontrado neste workspace.");
    await requireWorkspaceRole(supabase, channel.workspace_id, userId, WORKSPACE_MANAGE_ROLES);
    const { data: row, error } = await supabase.rpc("disconnect_oauth_channel", {
      _channel_id: data.channelId,
    });
    throwIfError(error);
    if (!row || row.id !== data.channelId || row.status !== "disconnected")
      throw new Error("Desconexão não confirmada.");
    return row;
  });
