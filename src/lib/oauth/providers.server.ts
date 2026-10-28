/**
 * OAuth provider registry. Each provider knows how to:
 *  - build an authorize URL (with state + redirect_uri)
 *  - exchange an authorization code for tokens
 *
 * Secrets are read lazily from process.env so missing providers produce a
 * clear error only when actually invoked.
 */

import type { Platform } from "@/lib/scheduler/publishers.server";

export interface ProviderTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  /** ISO-8601 string */
  expiresAt?: string;
  /** Provider-specific external account/page id to persist on channels.external_id */
  externalAccountId?: string;
  externalHandle?: string;
}

export interface Provider {
  platform: Platform;
  authUrl(args: { state: string; redirectUri: string }): string;
  exchange(args: { code: string; redirectUri: string }): Promise<ProviderTokens>;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

function expiresInToIso(seconds: number | undefined): string | undefined {
  if (!seconds || Number.isNaN(seconds)) return undefined;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/** Meta (Facebook + Instagram) — uses the same Facebook Login flow */
const meta: Provider = {
  platform: "facebook",
  authUrl({ state, redirectUri }) {
    const clientId = requireEnv("META_APP_ID");
    const scopes = [
      "public_profile",
      "email",
      "pages_show_list",
      "pages_manage_posts",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_content_publish",
    ].join(",");
    const u = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("state", state);
    u.searchParams.set("scope", scopes);
    u.searchParams.set("response_type", "code");
    return u.toString();
  },
  async exchange({ code, redirectUri }) {
    const clientId = requireEnv("META_APP_ID");
    const clientSecret = requireEnv("META_APP_SECRET");
    const u = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("client_secret", clientSecret);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("code", code);
    const res = await fetch(u);
    if (!res.ok) throw new Error(`meta exchange failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as {
      access_token: string;
      token_type?: string;
      expires_in?: number;
    };
    return {
      accessToken: json.access_token,
      tokenType: json.token_type,
      expiresAt: expiresInToIso(json.expires_in),
    };
  },
};

/** LinkedIn */
const linkedin: Provider = {
  platform: "linkedin",
  authUrl({ state, redirectUri }) {
    const clientId = requireEnv("LINKEDIN_CLIENT_ID");
    const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("state", state);
    u.searchParams.set("scope", "openid profile email w_member_social");
    return u.toString();
  },
  async exchange({ code, redirectUri }) {
    const clientId = requireEnv("LINKEDIN_CLIENT_ID");
    const clientSecret = requireEnv("LINKEDIN_CLIENT_SECRET");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`linkedin exchange failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as {
      access_token: string;
      expires_in?: number;
      refresh_token?: string;
      scope?: string;
    };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: expiresInToIso(json.expires_in),
      scope: json.scope,
    };
  },
};

/** Google (YouTube) */
const google: Provider = {
  platform: "youtube",
  authUrl({ state, redirectUri }) {
    const clientId = requireEnv("GOOGLE_CLIENT_ID");
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("prompt", "consent");
    u.searchParams.set("state", state);
    u.searchParams.set(
      "scope",
      [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
      ].join(" "),
    );
    return u.toString();
  },
  async exchange({ code, redirectUri }) {
    const clientId = requireEnv("GOOGLE_CLIENT_ID");
    const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`google exchange failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
    };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: expiresInToIso(json.expires_in),
      scope: json.scope,
      tokenType: json.token_type,
    };
  },
};

/**
 * Google Business Profile.
 *
 * Uses the same Google OAuth client as YouTube but a different scope, so the
 * consent screen clearly states what the user is granting. The dedicated scope
 * `business.manage` is intentionally broad — Google has no narrower scope for
 * creating local posts, and requesting it here keeps the grant visible instead
 * of hiding it inside the YouTube flow.
 *
 * Approval requirement: the Google Cloud project must have the Business Profile
 * APIs enabled and be allowlisted for `business.manage`. Without that, exchange
 * succeeds but the first API call returns 403 — hence the explicit check in
 * `discoverLocations` below rather than a silent empty list.
 */
const googleBusiness: Provider = {
  platform: "google_business",
  authUrl({ state, redirectUri }) {
    const clientId = requireEnv("GOOGLE_CLIENT_ID");
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("prompt", "consent");
    u.searchParams.set("state", state);
    u.searchParams.set("scope", "https://www.googleapis.com/auth/business.manage");
    return u.toString();
  },
  async exchange({ code, redirectUri }) {
    const clientId = requireEnv("GOOGLE_CLIENT_ID");
    const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok)
      throw new Error(`google_business exchange failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
    };

    // Discover the first verified location so the channel is usable immediately.
    // Failure here is not fatal: the user can pick a location later from the UI.
    let externalAccountId: string | undefined;
    let externalHandle: string | undefined;
    try {
      const locs = await listBusinessLocations(json.access_token);
      const first = locs[0];
      if (first) {
        externalAccountId = first.name;
        externalHandle = first.locationName;
      }
    } catch {
      /* company without a verified location, or API not yet allowlisted */
    }

    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: expiresInToIso(json.expires_in),
      scope: json.scope,
      tokenType: json.token_type,
      externalAccountId,
      externalHandle,
    };
  },
};

export interface BusinessLocation {
  /** Resource name: accounts/{a}/locations/{l} */
  name: string;
  accountId: string;
  locationId: string;
  locationName: string;
  address?: string;
  /** False when the listing is not verified — posts are rejected until it is. */
  verified: boolean;
}

/**
 * Lists the locations the authenticated user can manage.
 *
 * Google's Business Profile API is a two-step walk: accounts.list, then
 * locations.list per account. The flat result is what the channel picker needs.
 */
export async function listBusinessLocations(accessToken: string): Promise<BusinessLocation[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const accountsRes = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers },
  );

  if (accountsRes.status === 403) {
    throw new Error(
      "A API do Google Business Profile não está habilitada ou o projeto não está " +
        "aprovado para o escopo business.manage. Habilite as Business Profile APIs " +
        "no Google Cloud e solicite acesso.",
    );
  }
  if (!accountsRes.ok) {
    throw new Error(`accounts.list falhou: ${accountsRes.status} ${await accountsRes.text()}`);
  }

  const accountsJson = (await accountsRes.json()) as {
    accounts?: Array<{ name?: string; accountName?: string; type?: string }>;
  };

  const out: BusinessLocation[] = [];
  for (const acc of accountsJson.accounts ?? []) {
    const accountName = acc.name; // accounts/{id}
    if (!accountName) continue;
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations` +
        `?readMask=name,title,storefrontAddress,metadata`,
      { headers },
    );
    if (!locRes.ok) continue; // a single account failing must not void the rest
    const locJson = (await locRes.json()) as {
      locations?: Array<{
        name?: string;
        title?: string;
        storefrontAddress?: { addressLines?: string[]; locality?: string; regionCode?: string };
        metadata?: { canOperateLocalServices?: boolean; mapsUri?: string };
      }>;
    };

    for (const loc of locJson.locations ?? []) {
      // `name` comes back as "locations/{id}" in this API.
      const locationId = loc.name?.split("/").pop() ?? "";
      if (!locationId) continue;
      const addr = loc.storefrontAddress;
      out.push({
        name: `${accountName}/locations/${locationId}`,
        accountId: accountName.split("/").pop() ?? "",
        locationId,
        locationName: loc.title ?? `Location ${locationId}`,
        address: [addr?.addressLines?.join(", "), addr?.locality, addr?.regionCode]
          .filter(Boolean)
          .join(" · "),
        verified: loc.metadata?.canOperateLocalServices !== false,
      });
    }
  }

  return out;
}

/** TikTok (Login Kit / Content Posting API) */
const tiktok: Provider = {
  platform: "tiktok",
  authUrl({ state, redirectUri }) {
    const clientKey = requireEnv("TIKTOK_CLIENT_KEY");
    const u = new URL("https://www.tiktok.com/v2/auth/authorize/");
    u.searchParams.set("client_key", clientKey);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("state", state);
    u.searchParams.set("scope", "user.info.basic,video.upload,video.publish");
    return u.toString();
  },
  async exchange({ code, redirectUri }) {
    const clientKey = requireEnv("TIKTOK_CLIENT_KEY");
    const clientSecret = requireEnv("TIKTOK_CLIENT_SECRET");
    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`tiktok exchange failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      open_id?: string;
      scope?: string;
    };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: expiresInToIso(json.expires_in),
      scope: json.scope,
      externalAccountId: json.open_id,
    };
  },
};

export type SupportedProvider =
  | "meta"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "google"
  | "youtube"
  | "google_business"
  | "tiktok";

const REGISTRY: Record<SupportedProvider, Provider> = {
  meta,
  facebook: meta,
  instagram: { ...meta, platform: "instagram" },
  linkedin,
  google,
  youtube: google,
  google_business: googleBusiness,
  tiktok,
};

export function getProvider(name: string): Provider {
  const p = REGISTRY[name as SupportedProvider];
  if (!p) throw new Error(`unsupported oauth provider: ${name}`);
  return p;
}

export function listProviders(): SupportedProvider[] {
  return Object.keys(REGISTRY) as SupportedProvider[];
}
