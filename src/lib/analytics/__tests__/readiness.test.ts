import { describe, expect, it } from "vitest";
import { buildMetricsReadiness, collectionAge } from "../readiness";
import { platformsWithInsights } from "../insights.server";

const channel = (platform: string, status = "connected", id = platform) => ({
  id,
  platform,
  status,
  last_synced_at: null,
});
const readiness = (channels = [channel("instagram")], extra = {}) =>
  buildMetricsReadiness({
    channels,
    insightPlatforms: platformsWithInsights(),
    publishedPosts: 2,
    snapshots: 3,
    role: "owner",
    ...extra,
  });

describe("metrics readiness is based on implemented collectors", () => {
  it("distinguishes no registered channels from missing OAuth", () => {
    expect(readiness([]).reasonCode).toBe("no_channels");
    expect(readiness([channel("instagram", "manual")]).reasonCode).toBe("oauth_required");
  });
  it.each(["tiktok", "google_business", "x", "threads", "pinterest", "unknown"])(
    "does not promise per-post metrics for %s",
    (platform) => {
      const result = readiness([channel(platform)]);
      expect(result.measurableChannels).toBe(0);
      expect(result.channels[0].insightCapable).toBe(false);
      expect(result.reasonCode).toBe("unsupported");
    },
  );
  it.each(["instagram", "facebook", "youtube", "linkedin"])(
    "recognizes the implemented %s collector without certifying token validity",
    (platform) => {
      expect(readiness([channel(platform)]).measurableChannels).toBe(1);
    },
  );
  it("uses channel IDs rather than platform IDs when multiple accounts share a platform", () => {
    expect(
      readiness([
        channel("instagram", "connected", "a"),
        channel("instagram", "connected", "b"),
      ]).channels.map(({ id }) => id),
    ).toEqual(["a", "b"]);
  });
  it("explains missing posts and then missing collections", () => {
    expect(readiness(undefined, { publishedPosts: 0 }).reasonCode).toBe("no_posts");
    expect(readiness(undefined, { snapshots: 0 }).reasonCode).toBe("not_collected");
    expect(readiness().reasonCode).toBeNull();
  });
  it.each(["owner", "admin", "editor", "viewer"])(
    "exposes collection permission for %s",
    (role) => {
      expect(readiness(undefined, { role }).canSync).toBe(["owner", "admin"].includes(role));
    },
  );
});

describe("last collection age", () => {
  const now = Date.parse("2026-11-12T18:00:00Z");
  it("distinguishes missing, invalid and future dates", () => {
    expect(collectionAge(null, now)).toEqual({ key: "never" });
    expect(collectionAge("not-a-date", now)).toEqual({ key: "unknown" });
    expect(collectionAge("2026-11-13T18:00:00Z", now)).toEqual({ key: "unknown" });
  });
  it("returns relative units for translation rather than hardcoded Portuguese", () => {
    expect(collectionAge("2026-11-12T17:30:00Z", now)).toEqual({ key: "recent" });
    expect(collectionAge("2026-11-12T15:00:00Z", now)).toEqual({ key: "hours", count: 3 });
    expect(collectionAge("2026-11-10T18:00:00Z", now)).toEqual({ key: "days", count: 2 });
  });
});
