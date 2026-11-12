/**
 * OAuth provider registry. Each provider knows how to:
 *  - build an authorize URL (with state + redirect_uri)
 *  - exchange an authorization code for tokens
 *
 * Secrets are read lazily from process.env so missing providers produce a
 * clear error only when actually invoked.
 */

import { metaGraphBase, metaGraphVersion } from "./meta-version.server";
import type { Database } from "@/integrations/supabase/types";

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
  /** Safe resource identifiers only; tokens are stored separately and encrypted. */
  metadata?: Record<string, string | boolean | null>;
}

export interface Provider {
  platform: Database["public"]["Enums"]["social_platform"];
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

export class ProviderConnectionError extends Error {
  constructor(
    public readonly code:
      "account_selection_required" | "no_eligible_account" | "provider_unavailable",
  ) {
    super(code);
    this.name = "ProviderConnectionError";
  }
}
async function authorizedJson<T>(url: string | URL, accessToken: string): Promise<T> {
  if (!accessToken) throw new ProviderConnectionError("no_eligible_account");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new ProviderConnectionError("provider_unavailable");
  return response.json() as Promise<T>;
}
/** Never guess between Pages. Page tokens are encrypted in oauth_tokens, never put in channel metadata. */
function metaProvider(platform: "facebook" | "instagram"): Provider {
  return {
    platform,
    authUrl({ state, redirectUri }) {
      const url = new URL(`https://www.facebook.com/${metaGraphVersion()}/dialog/oauth`);
      url.searchParams.set("client_id", requireEnv("META_APP_ID"));
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("state", state);
      url.searchParams.set(
        "scope",
        "public_profile,email,pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish",
      );
      url.searchParams.set("response_type", "code");
      return url.href;
    },
    async exchange({ code, redirectUri }) {
      const url = new URL(metaGraphBase() + "/oauth/access_token");
      url.searchParams.set("client_id", requireEnv("META_APP_ID"));
      url.searchParams.set("client_secret", requireEnv("META_APP_SECRET"));
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("code", code);
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new ProviderConnectionError("provider_unavailable");
      const token = (await response.json()) as {
        access_token?: string;
        token_type?: string;
        expires_in?: number;
      };
      const pagesUrl = new URL(metaGraphBase() + "/me/accounts");
      pagesUrl.searchParams.set(
        "fields",
        "id,name,access_token,instagram_business_account{id,username}",
      );
      pagesUrl.searchParams.set("limit", "100");
      const result = await authorizedJson<{
        data?: Array<{
          id: string;
          name?: string;
          access_token?: string;
          instagram_business_account?: { id?: string; username?: string };
        }>;
        paging?: { next?: string };
      }>(pagesUrl, token.access_token ?? "");
      const eligible = (result.data ?? []).filter(
        (page) =>
          page.access_token &&
          page.id &&
          (platform === "facebook" || page.instagram_business_account?.id),
      );
      if (result.paging?.next || eligible.length > 1)
        throw new ProviderConnectionError("account_selection_required");
      const page = eligible[0];
      if (!page) throw new ProviderConnectionError("no_eligible_account");
      return {
        accessToken: page.access_token!,
        tokenType: token.token_type,
        expiresAt: expiresInToIso(token.expires_in),
        externalAccountId: platform === "instagram" ? page.instagram_business_account!.id : page.id,
        externalHandle:
          platform === "instagram" ? page.instagram_business_account?.username : page.name,
        metadata: {
          page_id: page.id,
          ...(platform === "instagram" ? { ig_user_id: page.instagram_business_account!.id! } : {}),
        },
      };
    },
  };
}
const meta = metaProvider("facebook");

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
    const profile = await authorizedJson<{ sub?: string; name?: string }>(
      "https://api.linkedin.com/v2/userinfo",
      json.access_token,
    );
    if (!profile.sub) throw new ProviderConnectionError("no_eligible_account");
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: expiresInToIso(json.expires_in),
      scope: json.scope,
      externalAccountId: profile.sub,
      externalHandle: profile.name,
      metadata: { person_id: profile.sub },
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
    const channels = await authorizedJson<{
      items?: Array<{ id?: string; snippet?: { title?: string } }>;
    }>(
      "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true",
      json.access_token,
    );
    if ((channels.items?.length ?? 0) > 1)
      throw new ProviderConnectionError("account_selection_required");
    const channel = channels.items?.[0];
    if (!channel?.id) throw new ProviderConnectionError("no_eligible_account");
    return {
      externalAccountId: channel.id,
      externalHandle: channel.snippet?.title,
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

    const locations = await listBusinessLocations(json.access_token);
    if (locations.length === 0) throw new ProviderConnectionError("no_eligible_account");
    const accountId = locations[0].accountId;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: expiresInToIso(json.expires_in),
      scope: json.scope,
      tokenType: json.token_type,
      externalAccountId: `accounts/${accountId}`,
      externalHandle: "Google Business — selecione uma unidade",
      metadata: { requires_location_selection: true, location_confirmed: false },
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
  const accounts: Array<{ name?: string }> = [];
  let pageToken: string | undefined;
  do {
    const url = new URL("https://mybusinessaccountmanagement.googleapis.com/v1/accounts");
    url.searchParams.set("pageSize", "20");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await authorizedJson<{
      accounts?: Array<{ name?: string }>;
      nextPageToken?: string;
    }>(url, accessToken);
    accounts.push(...(page.accounts ?? []));
    pageToken = page.nextPageToken;
    if (accounts.length > 2000) throw new ProviderConnectionError("account_selection_required");
  } while (pageToken);
  const out: BusinessLocation[] = [];
  for (const account of accounts) {
    if (!account.name || !/^accounts\/[A-Za-z0-9_-]+$/.test(account.name)) continue;
    pageToken = undefined;
    do {
      const url = new URL(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
      );
      url.searchParams.set("readMask", "name,title,storefrontAddress");
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const page = await authorizedJson<{
        locations?: Array<{
          name?: string;
          title?: string;
          storefrontAddress?: { addressLines?: string[]; locality?: string; regionCode?: string };
        }>;
        nextPageToken?: string;
      }>(url, accessToken);
      for (const location of page.locations ?? []) {
        if (!location.name || !/^locations\/[A-Za-z0-9_-]+$/.test(location.name)) continue;
        // The presence of a location is NOT proof of verification. Consult the real verification state.
        const state = await authorizedJson<{ hasVoiceOfMerchant?: boolean }>(
          `https://mybusinessverifications.googleapis.com/v1/${location.name}/VoiceOfMerchantState`,
          accessToken,
        );
        const locationId = location.name.split("/")[1];
        const addr = location.storefrontAddress;
        out.push({
          name: `${account.name}/locations/${locationId}`,
          accountId: account.name.split("/")[1],
          locationId,
          locationName: location.title ?? `Location ${locationId}`,
          verified: state.hasVoiceOfMerchant === true,
          address: [addr?.addressLines?.join(", "), addr?.locality, addr?.regionCode]
            .filter(Boolean)
            .join(" · "),
        });
        if (out.length > 2000) throw new ProviderConnectionError("account_selection_required");
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
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
  instagram: metaProvider("instagram"),
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
