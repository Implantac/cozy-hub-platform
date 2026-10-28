/**
 * VELT — Metric normalisation (pure, testable).
 *
 * Every platform reports the same reality with different vocabulary:
 * "plays" vs "video_views" vs "viewCount", "reach" vs "impressions" vs
 * "estimated_reach", "likes + comments + saves" vs a pre-computed "engagement".
 *
 * `analytics_snapshots.metrics` must be comparable across channels, otherwise
 * every downstream consumer (analytics charts, best-time-to-post, the Brain's
 * growth engine) silently compares apples to oranges. This module is the single
 * translation boundary.
 *
 * CANONICAL SHAPE written to `metrics`:
 *   impressions, reach, engagement, likes, comments, shares, saves, clicks,
 *   video_views, followers, engagement_rate
 */

export interface CanonicalMetrics {
  impressions: number;
  reach: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  video_views: number;
  followers: number;
  engagement_rate: number;
}

export const EMPTY_METRICS: CanonicalMetrics = {
  impressions: 0,
  reach: 0,
  engagement: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  clicks: 0,
  video_views: 0,
  followers: 0,
  engagement_rate: 0,
};

type Raw = Record<string, unknown>;

function num(...candidates: unknown[]): number {
  for (const c of candidates) {
    if (c === null || c === undefined || c === "") continue;
    const n = Number(c);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return 0;
}

/**
 * Engagement is computed from the parts when the platform does not provide it.
 * Defining it once matters: a like and a comment are not the same signal, but
 * adding them is better than ignoring the difference between platforms that
 * report only a total and platforms that report nothing.
 */
function deriveEngagement(likes: number, comments: number, shares: number, saves: number): number {
  return likes + comments + shares + saves;
}

function deriveRate(engagement: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((engagement / denominator) * 10000) / 10000; // 4 decimals
}

/* ------------------------------------------------------------------ */
/* Instagram Graph (media insights)                                    */
/* ------------------------------------------------------------------ */

/**
 * Instagram returns insights as `data: [{ name, values: [{ value }] }]` for
 * some metrics and flat `{ like_count }` for others. This accepts both.
 */
export function fromInstagram(media: Raw, insights: Raw): CanonicalMetrics {
  const insightValues = new Map<string, number>();
  const data = Array.isArray(insights.data) ? (insights.data as Raw[]) : [];
  for (const item of data) {
    const name = String(item.name ?? "");
    const values = Array.isArray(item.values) ? (item.values as Raw[]) : [];
    const first = values[0] ?? item.total_value ?? {};
    const total =
      num((first as Raw).value) || num((first as Raw).total) || num((item as Raw).total_value) || 0;
    if (name) insightValues.set(name, total);
  }

  const likes = num(media.like_count);
  const comments = num(media.comments_count);
  const saves = insightValues.get("saved") ?? 0;
  const shares = insightValues.get("shares") ?? 0;
  const reach = insightValues.get("reach") ?? 0;
  const impressions = insightValues.get("impressions") ?? insightValues.get("views") ?? reach;
  const engagement =
    insightValues.get("total_interactions") ?? deriveEngagement(likes, comments, shares, saves);

  return {
    ...EMPTY_METRICS,
    impressions,
    reach,
    engagement,
    likes,
    comments,
    shares,
    saves,
    video_views: insightValues.get("plays") ?? insightValues.get("video_views") ?? 0,
    engagement_rate: deriveRate(engagement, impressions || reach),
  };
}

/* ------------------------------------------------------------------ */
/* Facebook Page (post insights)                                       */
/* ------------------------------------------------------------------ */

export function fromFacebook(post: Raw, insights: Raw): CanonicalMetrics {
  const map = new Map<string, number>();
  const data = Array.isArray(insights.data) ? (insights.data as Raw[]) : [];
  for (const item of data) {
    const name = String(item.name ?? "");
    const values = Array.isArray(item.values) ? (item.values as Raw[]) : [];
    const first = (values[0] ?? {}) as Raw;
    if (name) map.set(name, num(first.value));
  }

  const likes = map.get("post_reactions_by_type_total")
    ? Object.values((map.get("post_reactions_by_type_total") as unknown as Raw) ?? {}).reduce(
        (a: number, b) => a + num(b),
        0,
      )
    : num(post.likes_count, post.like_count);

  const comments = num(post.comments_count);
  const shares = num(post.shares_count);
  const impressions = map.get("post_impressions") ?? map.get("post_impressions_unique") ?? 0;
  const reach = map.get("post_impressions_unique") ?? impressions;
  const clicks = map.get("post_clicks") ?? 0;
  const engagement =
    deriveEngagement(likes, comments, shares, 0) || num(map.get("post_engaged_users"));

  return {
    ...EMPTY_METRICS,
    impressions,
    reach,
    engagement,
    likes,
    comments,
    shares,
    clicks,
    video_views: map.get("post_video_views") ?? 0,
    engagement_rate: deriveRate(engagement, impressions || reach),
  };
}

/* ------------------------------------------------------------------ */
/* YouTube Data API v3 (videos.list -> statistics)                     */
/* ------------------------------------------------------------------ */

export function fromYouTube(statistics: Raw, channelStats?: Raw): CanonicalMetrics {
  const views = num(statistics.viewCount);
  const likes = num(statistics.likeCount);
  const comments = num(statistics.commentCount);

  // YouTube exposes no impressions for the public API (that lives in Analytics
  // API). Views are the honest stand-in and are recorded as such.
  return {
    ...EMPTY_METRICS,
    impressions: views,
    reach: views,
    engagement: deriveEngagement(likes, comments, 0, 0),
    likes,
    comments,
    video_views: views,
    followers: num(channelStats?.subscriberCount),
    engagement_rate: deriveRate(deriveEngagement(likes, comments, 0, 0), views),
  };
}

/* ------------------------------------------------------------------ */
/* LinkedIn (socialActions + organizationalEntityShareStatistics)      */
/* ------------------------------------------------------------------ */

export function fromLinkedIn(stats: Raw): CanonicalMetrics {
  const likes = num(stats.likeCount);
  const comments = num(stats.commentCount);
  const shares = num(stats.shareCount);
  const impressions = num(stats.impressionCount);
  const clicks = num(stats.clickCount);
  const engagement = num(stats.engagement, deriveEngagement(likes, comments, shares, 0));

  return {
    ...EMPTY_METRICS,
    impressions,
    reach: num(stats.uniqueImpressionsCount) || impressions,
    engagement,
    likes,
    comments,
    shares,
    clicks,
    engagement_rate: deriveRate(engagement, impressions),
  };
}

/* ------------------------------------------------------------------ */
/* Account-level rollups                                               */
/* ------------------------------------------------------------------ */

/** Instagram account insights -> followers + aggregate reach. */
export function fromInstagramAccount(insights: Raw): { followers: number; reach: number } {
  const data = Array.isArray(insights.data) ? (insights.data as Raw[]) : [];
  let followers = 0;
  let reach = 0;
  for (const item of data) {
    const name = String(item.name ?? "");
    // `total_value` arrives as `{ value: n }` on total-value metrics and as a
    // `values[].value` series on time-series metrics. Both must be handled.
    const totalValue = (item.total_value as Raw | undefined)?.value;
    const firstSeries = ((item.values as Raw[])?.[0] as Raw | undefined)?.value;
    const total = num(totalValue) || num(firstSeries);
    if (name === "follower_count" || name === "followers_count") followers = total;
    if (name === "reach") reach = total;
  }
  return { followers, reach };
}

/**
 * Merges metrics from a later observation into an earlier one.
 *
 * Why this exists: platform counters are cumulative per post (a like never
 * un-happens, except when it does — unlikes are real). Snapshots taken daily
 * therefore shouldn't sum; they should take the latest cumulative value per
 * post. This function encodes that rule so history stays coherent.
 */
export function mergeCumulative(
  previous: Partial<CanonicalMetrics>,
  next: Partial<CanonicalMetrics>,
): CanonicalMetrics {
  const out = { ...EMPTY_METRICS };
  for (const key of Object.keys(EMPTY_METRICS) as Array<keyof CanonicalMetrics>) {
    const prev = num(previous[key]);
    const cur = num(next[key]);
    // Take the max: guards against a provider briefly returning 0 or a lower
    // number (rate limiting, eventual consistency) and wiping real history.
    out[key] = Math.max(prev, cur);
  }
  out.engagement_rate = deriveRate(out.engagement, out.impressions || out.reach);
  return out;
}
