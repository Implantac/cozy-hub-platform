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
 *   - Meta              : stored Page grants require explicit reauthorization at expiry
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
  if (!res.ok)
    throw new Error(
      `refresh failed ${res.status}${res.status === 400 || res.status === 401 ? " — reconecte o canal" : ""}`,
    );
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("refresh returned invalid JSON");
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

const REFRESHERS: Record<string, (rt: string) => Promise<RefreshResult>> = {
  youtube: refreshGoogle,
  google_business: refreshGoogle,
  linkedin: refreshLinkedIn,
  tiktok: refreshTikTok,
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

  if (
    !stored.accessToken?.trim() ||
    stored.accessToken === "undefined" ||
    (stored.expiresAt && !Number.isFinite(Date.parse(stored.expiresAt)))
  )
    throw new Error("Token ou validade inválida — reconecte o canal.");
  const refresher = REFRESHERS[platform];
  const expired = needsRefresh(stored.expiresAt);
  const hasRefreshToken = Boolean(stored.refreshToken);

  // Stored Meta credentials are Page tokens, not user tokens for fb_exchange_token.
  // Never pretend that an expired Page grant can always be extended. Reauthorization is explicit.
  const canRefresh = Boolean(refresher) && hasRefreshToken;

  if (!expired && !hasExpiringSoon(stored.expiresAt)) {
    return { accessToken: stored.accessToken, refreshed: false };
  }
  if (!canRefresh) throw new Error("Token expirado sem renovação disponível — reconecte o canal.");

  const result = await refresher(
    hasRefreshToken ? String(stored.refreshToken) : stored.accessToken,
  );

  if (!result.accessToken?.trim() || result.accessToken === "undefined")
    throw new Error("Renovação sem token válido — reconecte o canal.");

  await saveToken(channelId, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken ?? stored.refreshToken ?? null,
    tokenType: stored.tokenType ?? "Bearer",
    scope: stored.scope ?? null,
    expiresAt: result.expiresAt ?? null,
  });

  const { error: statusError } = await supabaseAdmin
    .from("channels")
    .update({ status: "connected" })
    .eq("id", channelId);
  if (statusError)
    throw new Error("Não foi possível confirmar o estado do canal após a renovação.");

  return { accessToken: result.accessToken, refreshed: true };
}

function hasExpiringSoon(expiresAt?: string | null): boolean {
  return needsRefresh(expiresAt);
}
