/**
 * VELT — Per-post insight collectors (server-only).
 *
 * Each collector takes a published post (external id + channel) and returns
 * canonical metrics. The contract is deliberately narrow:
 *
 *   collect(ctx) -> { metrics, accountFollowers? } | null
 *
 * `null` means "this platform cannot report metrics for this post" — never an
 * error, because a missing metric is not a failure of the sync run. Throwing is
 * reserved for things the operator must act on (expired token, revoked scope),
 * which the caller turns into an actionable `last_error` on the channel.
 */

import type { CanonicalMetrics } from "./normalize";
import {
  fromFacebook,
  fromInstagram,
  fromInstagramAccount,
  fromLinkedIn,
  fromYouTube,
} from "./normalize";

export interface InsightContext {
  platform: string;
  externalPostId: string;
  accessToken: string;
  channelConfig: Record<string, unknown>;
  channelExternalId?: string | null;
}

export interface InsightResult {
  metrics: CanonicalMetrics;
  /** Account-level follower count, when the platform reports it per post sync. */
  accountFollowers?: number;
}

/** Raised when the platform refuses due to credentials — operator must act. */
export class InsightAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsightAuthError";
  }
}

/** Raised when the platform rate-limits us — back off and retry later. */
export class InsightRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsightRateLimitError";
  }
}

const GRAPH = "https://graph.facebook.com/v19.0";

async function graphJson<T>(url: URL): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text for the error message */
  }

  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: number } })?.error;
    const code = err?.code;
    if (res.status === 401 || code === 190) {
      throw new InsightAuthError(
        `Token sem permissão para ler insights: ${err?.message ?? res.status}. Reconecte o canal.`,
      );
    }
    if (res.status === 429 || code === 4 || code === 17) {
      throw new InsightRateLimitError(`Rate limit do provedor: ${err?.message ?? res.status}`);
    }
    throw new Error(`Falha ao ler insights (${res.status}): ${err?.message ?? text.slice(0, 200)}`);
  }
  return json as T;
}

/* ------------------------------------------------------------------ */
/* Instagram                                                           */
/* ------------------------------------------------------------------ */

const IG_INSIGHT_METRICS = [
  "impressions",
  "reach",
  "saved",
  "shares",
  "total_interactions",
  "plays",
];

export async function collectInstagram(ctx: InsightContext): Promise<InsightResult> {
  // Bearer auth is accepted by the Graph API and is preferred over query params
  // so the token never lands in a URL that could be logged.
  const url = new URL(`${GRAPH}/${ctx.externalPostId}/insights`);
  url.searchParams.set("metric", IG_INSIGHT_METRICS.join(","));
  url.searchParams.set("access_token", ctx.accessToken);

  // Basic counters live on the media node itself.
  const mediaUrl = new URL(`${GRAPH}/${ctx.externalPostId}`);
  mediaUrl.searchParams.set("fields", "like_count,comments_count,media_type,timestamp");
  mediaUrl.searchParams.set("access_token", ctx.accessToken);

  const [insights, media] = await Promise.all([
    graphJson<Record<string, unknown>>(url).catch((err) => {
      // Insights require a Business/Creator account. A personal account is not a
      // sync failure — it simply has no data source.
      if (err instanceof InsightAuthError) return { data: [] } as Record<string, unknown>;
      throw err;
    }),
    graphJson<Record<string, unknown>>(mediaUrl),
  ]);

  const metrics = fromInstagram(media, insights);

  let accountFollowers: number | undefined;
  const igUserId =
    (ctx.channelConfig.ig_user_id as string | undefined) ?? ctx.channelExternalId ?? undefined;
  if (igUserId) {
    try {
      const accUrl = new URL(`${GRAPH}/${igUserId}`);
      accUrl.searchParams.set("fields", "followers_count");
      accUrl.searchParams.set("access_token", ctx.accessToken);
      const acc = await graphJson<{ followers_count?: number }>(accUrl);
      accountFollowers = Number(acc.followers_count ?? 0) || undefined;
      void fromInstagramAccount; // account-insight parser kept for future use
    } catch {
      // Follower count is a nice-to-have; never fail the sync over it.
    }
  }

  return { metrics, accountFollowers };
}

/* ------------------------------------------------------------------ */
/* Facebook Page                                                       */
/* ------------------------------------------------------------------ */

const FB_INSIGHT_METRICS = [
  "post_impressions",
  "post_impressions_unique",
  "post_engaged_users",
  "post_clicks",
  "post_video_views",
  "post_reactions_by_type_total",
];

export async function collectFacebook(ctx: InsightContext): Promise<InsightResult> {
  const url = new URL(`${GRAPH}/${ctx.externalPostId}/insights`);
  url.searchParams.set("metric", FB_INSIGHT_METRICS.join(","));
  url.searchParams.set("access_token", ctx.accessToken);

  const postUrl = new URL(`${GRAPH}/${ctx.externalPostId}`);
  postUrl.searchParams.set("fields", "likes.summary(true),comments.summary(true),shares");
  postUrl.searchParams.set("access_token", ctx.accessToken);

  const [insights, post] = await Promise.all([
    graphJson<Record<string, unknown>>(url).catch(() => ({ data: [] }) as Record<string, unknown>),
    graphJson<Record<string, unknown>>(postUrl),
  ]);

  // Flatten Facebook's summary objects before normalisation.
  const flattened: Record<string, unknown> = {
    likes_count: (post.likes as { summary?: { total_count?: number } } | undefined)?.summary
      ?.total_count,
    comments_count: (post.comments as { summary?: { total_count?: number } } | undefined)?.summary
      ?.total_count,
    shares_count: (post.shares as { count?: number } | undefined)?.count,
  };

  return { metrics: fromFacebook(flattened, insights) };
}

/* ------------------------------------------------------------------ */
/* YouTube                                                             */
/* ------------------------------------------------------------------ */

export async function collectYouTube(ctx: InsightContext): Promise<InsightResult> {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "statistics");
  url.searchParams.set("id", ctx.externalPostId);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ctx.accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new InsightAuthError(`YouTube recusou a leitura de estatísticas (${res.status}).`);
    }
    if (res.status === 429) throw new InsightRateLimitError("Cota do YouTube esgotada.");
    throw new Error(`YouTube ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = JSON.parse(text) as { items?: Array<{ statistics?: Record<string, unknown> }> };
  const stats = json.items?.[0]?.statistics;
  if (!stats) return { metrics: fromYouTube({}) };

  let channelStats: Record<string, unknown> | undefined;
  try {
    const channelId = String(stats.channelId ?? ctx.channelExternalId ?? "");
    if (channelId) {
      const chUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
      chUrl.searchParams.set("part", "statistics");
      chUrl.searchParams.set("id", channelId);
      const chRes = await fetch(chUrl, { headers: { Authorization: `Bearer ${ctx.accessToken}` } });
      if (chRes.ok) {
        const chJson = (await chRes.json()) as {
          items?: Array<{ statistics?: Record<string, unknown> }>;
        };
        channelStats = chJson.items?.[0]?.statistics;
      }
    }
  } catch {
    /* followers are optional */
  }

  return {
    metrics: fromYouTube(stats, channelStats),
    accountFollowers: channelStats
      ? Number(channelStats.subscriberCount ?? 0) || undefined
      : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* LinkedIn                                                            */
/* ------------------------------------------------------------------ */

const LINKEDIN_VERSION = "202601";

export async function collectLinkedIn(ctx: InsightContext): Promise<InsightResult> {
  // Share statistics are scoped to the organisation; personal posts expose only
  // social actions (likes/comments).
  const orgId = ctx.channelConfig.organization_id as string | undefined;
  const headers = {
    Authorization: `Bearer ${ctx.accessToken}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };

  const socialRes = await fetch(
    `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(ctx.externalPostId)}`,
    { headers },
  );

  if (socialRes.status === 401 || socialRes.status === 403) {
    throw new InsightAuthError("LinkedIn recusou a leitura de métricas — reconecte o canal.");
  }
  if (socialRes.status === 429) throw new InsightRateLimitError("Rate limit do LinkedIn.");

  let stats: Record<string, unknown> = {};
  if (socialRes.ok) {
    const json = (await socialRes.json()) as {
      likesSummary?: { totalLikes?: number };
      commentsSummary?: { totalFirstLevelComments?: number };
    };
    stats = {
      likeCount: json.likesSummary?.totalLikes ?? 0,
      commentCount: json.commentsSummary?.totalFirstLevelComments ?? 0,
    };
  }

  if (orgId) {
    const shareUrn = encodeURIComponent(ctx.externalPostId);
    const statUrl =
      `https://api.linkedin.com/rest/organizationalEntityShareStatistics` +
      `?q=organizationalEntity&organizationalEntity=${encodeURIComponent(`urn:li:organization:${orgId}`)}` +
      `&shares=List(${shareUrn})`;
    const statRes = await fetch(statUrl, { headers });
    if (statRes.ok) {
      const json = (await statRes.json()) as {
        elements?: Array<{
          totalShareStatistics?: Record<string, number>;
        }>;
      };
      const s = json.elements?.[0]?.totalShareStatistics ?? {};
      stats = {
        ...stats,
        impressionCount: s.impressionCount ?? 0,
        uniqueImpressionsCount: s.uniqueImpressionsCount ?? 0,
        shareCount: s.shareCount ?? 0,
        clickCount: s.clickCount ?? 0,
        engagement: s.engagement ?? 0,
      };
    }
  }

  return { metrics: fromLinkedIn(stats) };
}

/* ------------------------------------------------------------------ */
/* TikTok                                                              */
/* ------------------------------------------------------------------ */

/**
 * TikTok's metrics require the `video.list` scope, which is a separate app
 * review from posting. We report null rather than guessing.
 */
export async function collectTikTok(_ctx: InsightContext): Promise<InsightResult | null> {
  return null;
}

/**
 * Google Business Profile reports insights only in aggregate per location
 * (`locations/{id}/reportInsights`), not per local post. Since VELT's snapshot
 * model is per post, there is nothing to attribute. Reporting null is the
 * honest answer; the UI already explains that this channel is publish-only.
 */
export async function collectGoogleBusiness(_ctx: InsightContext): Promise<InsightResult | null> {
  return null;
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

const COLLECTORS: Record<string, (ctx: InsightContext) => Promise<InsightResult | null>> = {
  instagram: collectInstagram,
  facebook: collectFacebook,
  youtube: collectYouTube,
  linkedin: collectLinkedIn,
  tiktok: collectTikTok,
  google_business: collectGoogleBusiness,
};

export function collectorFor(platform: string) {
  return COLLECTORS[platform] ?? null;
}

export function platformsWithInsights(): string[] {
  return Object.entries(COLLECTORS)
    .filter(([key]) => !["tiktok", "google_business"].includes(key))
    .map(([key]) => key);
}
