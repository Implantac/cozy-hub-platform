import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getProvider } from "@/lib/oauth/providers.server";
import { verifyState } from "@/lib/oauth/state.server";
import { saveToken } from "@/lib/oauth/store.server";

/**
 * OAuth callback — provider redirects the user here after consent.
 * URL shape:  /api/public/oauth/callback/{provider}?code=...&state=...
 *
 * Steps:
 *   1. verify HMAC-signed state (workspace_id is authoritative from here)
 *   2. exchange code for tokens with the provider
 *   3. upsert channel (status=connected) and store encrypted tokens
 *   4. redirect the user back to the app
 */
export const Route = createFileRoute("/api/public/oauth/callback/$provider")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const providerError = url.searchParams.get("error");

        if (providerError) {
          // Do NOT echo provider-supplied error text back to the browser.
          console.warn("[oauth/callback] provider error:", providerError);
          return redirectBack(url.origin, "oauth_error=provider_denied");
        }
        if (!code || !state) {
          return new Response("missing code or state", { status: 400 });
        }

        let payload;
        try {
          payload = verifyState(state);
        } catch (err) {
          // Internal detail stays server-side; client gets a generic message.
          console.warn("[oauth/callback] state verification failed:", err);
          return new Response("state validation failed", { status: 400 });
        }
        if (payload.provider !== params.provider) {
          return new Response("provider mismatch", { status: 400 });
        }

        try {
          const provider = getProvider(params.provider);
          const tokens = await provider.exchange({
            code,
            redirectUri: payload.redirectUri,
          });

          // Upsert channel
          const { data: channel, error: chErr } = await supabaseAdmin
            .from("channels")
            .upsert(
              {
                workspace_id: payload.workspaceId,
                brand_id: payload.brandId ?? null,
                platform: provider.platform as "facebook" | "instagram" | "linkedin" | "tiktok" | "youtube",
                external_id: tokens.externalAccountId ?? `oauth_${Date.now()}`,
                handle: tokens.externalHandle ?? null,
                status: "connected",
                connected_at: new Date().toISOString(),
                metadata: { provider: params.provider, scope: tokens.scope ?? null },
              },
              { onConflict: "workspace_id,platform,external_id" },
            )
            .select()
            .single();
          if (chErr || !channel) {
            throw new Error(`channel upsert failed: ${chErr?.message ?? "unknown"}`);
          }

          await saveToken(channel.id, {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            tokenType: tokens.tokenType,
            scope: tokens.scope,
            expiresAt: tokens.expiresAt,
          });

          await supabaseAdmin.from("domain_events").insert({
            workspace_id: payload.workspaceId,
            event_type: "channel.connected",
            payload: {
              channel_id: channel.id,
              platform: provider.platform,
              provider: params.provider,
            },
          });

          return redirectBack(url.origin, `oauth_connected=${provider.platform}`);
        } catch (err) {
          // Log full detail server-side only — never embed in a client redirect.
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[oauth/callback] error:", msg);
          return redirectBack(url.origin, "oauth_error=connection_failed");
        }
      },
    },
  },
});

function redirectBack(origin: string, query: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${origin}/app?${query}` },
  });
}
