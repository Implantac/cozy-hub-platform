export type ReadinessReason =
  "no_channels" | "oauth_required" | "unsupported" | "no_posts" | "not_collected";

type Channel = {
  id: string;
  platform: string;
  status: string;
  last_synced_at: string | null;
};

/** Capability describes implemented collectors, not provider approval or valid tokens. */
export function buildMetricsReadiness({
  channels,
  insightPlatforms,
  publishedPosts,
  snapshots,
  role,
}: {
  channels: Channel[];
  insightPlatforms: string[];
  publishedPosts: number;
  snapshots: number;
  role: string;
}) {
  const supported = new Set(insightPlatforms);
  const items = channels.map((channel) => ({
    id: channel.id,
    platform: channel.platform,
    status: channel.status,
    lastSyncedAt: channel.last_synced_at,
    insightCapable: supported.has(channel.platform),
  }));
  const connectedChannels = items.filter((channel) => channel.status === "connected").length;
  const measurableChannels = items.filter(
    (channel) => channel.status === "connected" && channel.insightCapable,
  ).length;
  const reasonCode: ReadinessReason | null =
    items.length === 0
      ? "no_channels"
      : connectedChannels === 0
        ? "oauth_required"
        : measurableChannels === 0
          ? "unsupported"
          : publishedPosts === 0
            ? "no_posts"
            : snapshots === 0
              ? "not_collected"
              : null;

  return {
    channels: items,
    connectedChannels,
    measurableChannels,
    publishedPosts,
    snapshots,
    canSync: role === "owner" || role === "admin",
    reasonCode,
  };
}

export type MetricsReadiness = ReturnType<typeof buildMetricsReadiness>;

export function collectionAge(iso: string | null, now = Date.now()) {
  if (!iso) return { key: "never" } as const;
  const time = Date.parse(iso);
  if (!Number.isFinite(time) || time > now + 60_000) return { key: "unknown" } as const;
  const hours = Math.max(0, Math.floor((now - time) / 3_600_000));
  if (hours < 1) return { key: "recent" } as const;
  if (hours < 24) return { key: "hours", count: hours } as const;
  return { key: "days", count: Math.floor(hours / 24) } as const;
}
