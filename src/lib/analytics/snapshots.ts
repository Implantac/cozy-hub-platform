import type { CanonicalMetrics } from "./normalize";

export interface Snapshot {
  id: string;
  content_id: string | null;
  channel_id: string | null;
  captured_at: string;
  metrics: unknown;
  channel: { platform: string } | null;
  content?: { title: string | null } | null;
}
const KEYS: Array<keyof CanonicalMetrics> = [
  "impressions",
  "reach",
  "engagement",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
  "video_views",
  "followers",
];
/** Provider metadata is not a metric. Reject NaN, Infinity, negative and arbitrary JSON values. */
export function cleanMetrics(raw: unknown): Partial<CanonicalMetrics> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const input = raw as Record<string, unknown>;
  const clean: Partial<CanonicalMetrics> = {};
  for (const key of KEYS) {
    const value = input[key];
    if (typeof value !== "number" && !(typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value)))
      continue;
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) clean[key] = n;
  }
  return clean;
}
export function snapshotKey(row: Pick<Snapshot, "content_id" | "channel_id">) {
  return `${row.channel_id ?? ""}:${row.content_id ?? ""}`;
}
/** Counters are lifetime cumulative. Repeated collections must not be added together. */
export function latestSnapshots(rows: Snapshot[], perDay = false): Snapshot[] {
  const latest = new Map<string, Snapshot>();
  for (const row of rows) {
    if (!row.channel_id || !row.content_id || !Number.isFinite(Date.parse(row.captured_at)))
      continue;
    const raw =
      row.metrics && typeof row.metrics === "object"
        ? (row.metrics as Record<string, unknown>)
        : {};
    if (typeof raw.post_id === "string" && raw.post_id.startsWith("sim_")) continue;
    if (Object.keys(cleanMetrics(row.metrics)).length === 0) continue;
    const key = snapshotKey(row) + (perDay ? ":" + row.captured_at.slice(0, 10) : "");
    const previous = latest.get(key);
    if (
      !previous ||
      Date.parse(row.captured_at) > Date.parse(previous.captured_at) ||
      (row.captured_at === previous.captured_at && row.id > previous.id)
    )
      latest.set(key, row);
  }
  return [...latest.values()].sort(
    (a, b) => a.captured_at.localeCompare(b.captured_at) || a.id.localeCompare(b.id),
  );
}
export function aggregateSnapshots(rows: Snapshot[]) {
  const totals = { impressions: 0, engagement: 0, reach: 0, posts: 0 };
  const platforms = new Map<
    string,
    { platform: string; impressions: number; engagement: number }
  >();
  for (const row of latestSnapshots(rows)) {
    const m = cleanMetrics(row.metrics);
    totals.impressions += m.impressions ?? 0;
    totals.engagement += m.engagement ?? 0;
    totals.reach += m.reach ?? 0;
    totals.posts++;
    const platform = row.channel?.platform ?? "other";
    const value = platforms.get(platform) ?? { platform, impressions: 0, engagement: 0 };
    value.impressions += m.impressions ?? 0;
    value.engagement += m.engagement ?? 0;
    platforms.set(platform, value);
  }
  const daily = new Map<
    string,
    { date: string; impressions: number; engagement: number; reach: number }
  >();
  for (const row of latestSnapshots(rows, true)) {
    const date = row.captured_at.slice(0, 10);
    const m = cleanMetrics(row.metrics);
    const d = daily.get(date) ?? { date, impressions: 0, engagement: 0, reach: 0 };
    d.impressions += m.impressions ?? 0;
    d.engagement += m.engagement ?? 0;
    d.reach += m.reach ?? 0;
    daily.set(date, d);
  }
  return {
    totals,
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    byPlatform: [...platforms.values()].sort((a, b) => a.platform.localeCompare(b.platform)),
  };
}
