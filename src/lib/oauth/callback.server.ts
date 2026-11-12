import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireWorkspaceRole, assertBrandInWorkspace } from "@/lib/api/_workspace";
import { WORKSPACE_MANAGE_ROLES } from "@/lib/workspace/permissions";
import { getProvider, ProviderConnectionError } from "./providers.server";
import { encryptToken } from "./crypto.server";
import {
  verifyState,
  stateCookieName,
  stateMatchesCookie,
  STATE_COOKIE_PATH,
} from "./state.server";

/** No token, provider-supplied error, or privileged database detail is returned to the browser. */
export async function handleOAuthCallback(request: Request, providerId: string): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  let payload;
  let cookieName: string;
  try {
    cookieName = stateCookieName(providerId);
    if (!state) throw new Error("Missing OAuth state");
    payload = verifyState(state);
    const cookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    if (payload.provider !== providerId || !stateMatchesCookie(state, cookie))
      throw new Error("OAuth state/browser mismatch");
    const expected = new URL(payload.redirectUri);
    if (
      expected.pathname !== `/api/public/oauth/callback/${providerId}` ||
      (process.env.APP_ORIGIN && expected.origin !== new URL(process.env.APP_ORIGIN).origin)
    )
      throw new Error("OAuth callback origin mismatch");
  } catch {
    return new Response("Não foi possível validar esta autorização. Inicie novamente em Canais.", {
      status: 400,
      headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" },
    });
  }
  const origin = new URL(payload.redirectUri).origin;
  const redirect = (key: string, value: string) => {
    const target = new URL("/app/channels", origin);
    target.searchParams.set(key, value);
    return new Response(null, {
      status: 302,
      headers: {
        Location: target.href,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Set-Cookie": `${cookieName}=; Path=${STATE_COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Lax${origin.startsWith("https:") ? "; Secure" : ""}`,
      },
    });
  };
  if (url.searchParams.has("error")) return redirect("oauth_error", "provider_denied");
  const code = url.searchParams.get("code");
  if (!code || code.length > 8192) return redirect("oauth_error", "connection_failed");
  try {
    // Consent can take minutes: starting as admin is not authority to finish as a viewer.
    await requireWorkspaceRole(
      supabaseAdmin,
      payload.workspaceId,
      payload.userId,
      WORKSPACE_MANAGE_ROLES,
    );
    await assertBrandInWorkspace(supabaseAdmin, payload.workspaceId, payload.brandId ?? undefined);
    const provider = getProvider(providerId);
    const tokens = await provider.exchange({ code, redirectUri: payload.redirectUri });
    if (!tokens.accessToken?.trim() || !tokens.externalAccountId?.trim())
      throw new Error("The provider did not return a usable external account");
    const metadata = {
      ...(tokens.metadata ?? {}),
      provider: providerId,
      scope: tokens.scope ?? null,
    };
    // The RPC rechecks role/brand while holding locks, then commits all three rows atomically.
    const { data: channel, error } = await supabaseAdmin.rpc("complete_oauth_connection", {
      _workspace_id: payload.workspaceId,
      _actor_id: payload.userId,
      _brand_id: payload.brandId ?? null,
      _platform: provider.platform,
      _external_id: tokens.externalAccountId,
      _handle: tokens.externalHandle ?? null,
      _metadata: metadata,
      _access_ciphertext: encryptToken(tokens.accessToken),
      _refresh_ciphertext: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
      _token_type: tokens.tokenType ?? null,
      _scope: tokens.scope ?? null,
      _expires_at: tokens.expiresAt ?? null,
    });
    if (
      error ||
      !channel ||
      channel.workspace_id !== payload.workspaceId ||
      channel.status !== "connected"
    )
      throw new Error("OAuth persistence was not confirmed");
    return redirect("oauth_connected", provider.platform);
  } catch (error) {
    // Upstream error bodies may contain credentials. Deliberately do not log them.
    console.warn("[oauth/callback] authorization or connection failed; no success reported");
    return redirect(
      "oauth_error",
      error instanceof ProviderConnectionError ? error.code : "connection_failed",
    );
  }
}
