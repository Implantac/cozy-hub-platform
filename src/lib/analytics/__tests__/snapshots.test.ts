import { describe, it, expect } from "vitest";
import { aggregateSnapshots, cleanMetrics, latestSnapshots, type Snapshot } from "../snapshots";
function row(
  id: string,
  channel = "a",
  date = "2026-11-12T12:00:00Z",
  metrics: unknown = { impressions: 100, engagement: 10 },
): Snapshot {
  return {
    id,
    channel_id: channel,
    content_id: "post",
    captured_at: date,
    metrics,
    channel: { platform: channel === "a" ? "instagram" : "facebook" },
    content: { title: "A" },
  };
}
describe("cumulative snapshots are per content AND channel", () => {
  it("uses the latest snapshot, never the sum of repeat collections", () => {
    const result = aggregateSnapshots([
      row("1", "a", "2026-11-11T12:00:00Z"),
      row("2", "a", "2026-11-12T12:00:00Z", { impressions: 120, engagement: 12 }),
    ]);
    expect(result.totals).toEqual({ impressions: 120, engagement: 12, reach: 0, posts: 1 });
    expect(result.daily).toHaveLength(2);
  });
  it("keeps the same content published to different accounts/platforms separate", () => {
    const result = aggregateSnapshots([
      row("1"),
      row("2", "b", undefined, { impressions: 200, engagement: 50 }),
    ]);
    expect(result.totals).toEqual({ impressions: 300, engagement: 60, reach: 0, posts: 2 });
    expect(result.byPlatform).toEqual([
      { platform: "facebook", impressions: 200, engagement: 50 },
      { platform: "instagram", impressions: 100, engagement: 10 },
    ]);
  });
  it("deduplicates repeat same-day collections separately from the period total", () => {
    const result = aggregateSnapshots([
      row("1", "a", "2026-11-12T10:00:00Z"),
      row("2", "a", "2026-11-12T18:00:00Z", { impressions: 125, engagement: 13 }),
    ]);
    expect(result.daily).toEqual([
      { date: "2026-11-12", impressions: 125, engagement: 13, reach: 0 },
    ]);
    expect(result.totals.posts).toBe(1);
  });
  it("is independent of query ordering and has a stable tie break", () => {
    const rows = [row("a"), row("z", "a", undefined, { impressions: 123 })];
    expect(aggregateSnapshots(rows)).toEqual(aggregateSnapshots([...rows].reverse()));
    expect(aggregateSnapshots(rows).totals.impressions).toBe(123);
  });
  it.each([
    null,
    {},
    [],
    { impressions: NaN },
    { impressions: Infinity },
    { impressions: -1 },
    { impressions: true },
    { impressions: { value: 10 } },
  ])("does not turn invalid metrics into observed posts: %j", (metrics) => {
    expect(latestSnapshots([row("1", "a", undefined, metrics)])).toEqual([]);
  });
  it("rejects null entity IDs, invalid dates and simulated upstream IDs", () => {
    expect(
      aggregateSnapshots([
        { ...row("1"), channel_id: null },
        { ...row("2"), content_id: null },
        { ...row("3"), captured_at: "invalid" },
        row("4", "a", undefined, { impressions: 100, post_id: "sim_post" }),
      ]).totals.posts,
    ).toBe(0);
  });
  it("cleans only finite canonical counters, never provider metadata", () => {
    expect(
      cleanMetrics({
        impressions: "12",
        likes: 0,
        engagement: -5,
        post_id: "123",
        job_id: "99",
        source: "sync",
        engagement_rate: 100,
        reach: "",
        saves: "1e9",
      }),
    ).toEqual({ impressions: 12, likes: 0 });
  });
});
