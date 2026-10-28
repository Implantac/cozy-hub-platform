/**
 * VELT — OAuth token refresh (server-only).
 *
 * Real publishing fails for one boring reason far more often than any other:
 * the access token expired before the scheduled job ran. A post scheduled three
 * weeks out will almost never have a valid token at execution time. The
 * dispatcher therefore refreshes proactively, inside the job, before calling the
 * platform — never assuming the token captured at connect time is still good.
 *
 * Refresh strategies differ per provider:
 *   - Google (YouTube)  : standard OAuth2 refresh_token grant
 *   - LinkedIn          : standard OAuth2 refresh_token grant
 *   - TikTok            : refresh_token grant, rotates the refresh token
 *   - Meta              : no refresh_token; exchange for a long-lived token,
 *                         then the long-lived token is valid ~60 days
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getToken, saveToken } from "./store.server";

/** Refresh when the token expires within this window. */
const EXPIRY_SKEW_MS = 5 * 60_000;

export interface RefreshContext {
  platform: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
}

export function needsRefresh(expiresAt?: string | null, now = Date.now()): boolean {
  if (!expiresAt) return false; // unknown expiry: try the token as-is
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t - EXPIRY_SKEW_MS <= now;
}

interface RefreshResult {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
}

async function postForm(
  url: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`refresh failed ${res.status}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`refresh returned non-JSON: ${text.slice(0, 200)}`);
  }
}

function isoFromSeconds(sec: unknown): string | undefined {
  const n = Number(sec);
  if (!n || Number.isNaN(n)) return undefined;
  return new Date(Date.now() + n * 1000).toISOString();
}

/** Google-family (YouTube) refresh. */
async function refreshGoogle(refreshToken: string): Promise<RefreshResult> {
  const json = await postForm("https://oauth2.googleapis.com/token", {
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  return {
    accessToken: String(json.access_token),
    refreshToken,
    expiresAt: isoFromSeconds(json.expires_in),
  };
}

/** LinkedIn refresh. */
async function refreshLinkedIn(refreshToken: string): Promise<RefreshResult> {
  const json = await postForm("https://www.linkedin.com/oauth/v2/accessToken", {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
  });
  return {
    accessToken: String(json.access_token),
    refreshToken: (json.refresh_token as string) ?? refreshToken,
    expiresAt: isoFromSeconds(json.expires_in),
  };
}

/** TikTok refresh (rotates the refresh token — must be persisted). */
async function refreshTikTok(refreshToken: string): Promise<RefreshResult> {
  const json = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
    client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
    client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const data = (json.data as Record<string, unknown> | undefined) ?? json;
  return {
    accessToken: String(data.access_token),
    refreshToken: (data.refresh_token as string) ?? refreshToken,
    expiresAt: isoFromSeconds(data.expires_in),
  };
}

/**
 * Meta has no refresh token. A short-lived user token is exchanged for a
 * long-lived one (60 days); a long-lived token is refreshed by calling the same
 * endpoint, which restarts the 60-day clock.
 */
async function refreshMeta(accessToken: string): Promise<RefreshResult> {
  const url = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  url.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
  url.searchParams.set("fb_exchange_token", accessToken);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`meta refresh failed ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("meta refresh returned no access_token");
  return {
    accessToken: json.access_token,
    refreshToken: null,
    expiresAt:
      isoFromSeconds(json.expires_in) ?? new Date(Date.now() + 60 * 86400_000).toISOString(),
  };
}

const REFRESHERS: Record<string, (rt: string) => Promise<RefreshResult>> = {
  youtube: refreshGoogle,
  google_business: refreshGoogle,
  linkedin: refreshLinkedIn,
  tiktok: refreshTikTok,
  instagram: refreshMeta,
  facebook: refreshMeta,
};

/**
 * Returns a usable access token for a channel, refreshing and persisting when
 * the current one is expired or about to expire.
 *
 * Throws a non-retryable-shaped error when the channel was never connected or
 * the refresh token is gone — retrying cannot fix those.
 */
export async function getFreshToken(
  channelId: string,
  platform: string,
): Promise<{
  accessToken: string;
  refreshed: boolean;
}> {
  const stored = await getToken(channelId);
  if (!stored) {
    throw new Error("canal sem token OAuth — reconecte o canal antes de publicar");
  }

  const refresher = REFRESHERS[platform];
  const expired = needsRefresh(stored.expiresAt);
  const hasRefreshToken = Boolean(stored.refreshToken);

  // Meta can always extend a token; other providers need a refresh token.
  const canRefresh =
    Boolean(refresher) && (hasRefreshToken || platform === "instagram" || platform === "facebook");

  if (!expired && !hasExpiringSoon(stored.expiresAt)) {
    return { accessToken: stored.accessToken, refreshed: false };
  }
  if (!canRefresh) {
    return { accessToken: stored.accessToken, refreshed: false };
  }

  const result = await refresher(
    hasRefreshToken ? String(stored.refreshToken) : stored.accessToken,
  );

  await saveToken(channelId, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? stored.refreshToken ?? null,
    tokenType: stored.tokenType ?? "Bearer",
    scope: stored.scope ?? null,
    expiresAt: result.expiresAt ?? null,
  });

  await supabaseAdmin
    .from("channels")
    .update({ last_synced_at: new Date().toISOString(), status: "connected" })
    .eq("id", channelId);

  return { accessToken: result.accessToken, refreshed: true };
}

function hasExpiringSoon(expiresAt?: string | null): boolean {
  return needsRefresh(expiresAt);
}
