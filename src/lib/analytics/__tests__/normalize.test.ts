import { describe, expect, it } from "vitest";
import {
  EMPTY_METRICS,
  fromFacebook,
  fromInstagram,
  fromInstagramAccount,
  fromLinkedIn,
  fromYouTube,
  mergeCumulative,
} from "@/lib/analytics/normalize";

describe("fromInstagram", () => {
  it("parses the insights data/values envelope", () => {
    const media = { like_count: 120, comments_count: 15 };
    const insights = {
      data: [
        { name: "impressions", values: [{ value: 4000 }] },
        { name: "reach", values: [{ value: 3100 }] },
        { name: "saved", values: [{ value: 40 }] },
        { name: "shares", values: [{ value: 10 }] },
        { name: "plays", values: [{ value: 2200 }] },
      ],
    };
    const m = fromInstagram(media, insights);
    expect(m.impressions).toBe(4000);
    expect(m.reach).toBe(3100);
    expect(m.likes).toBe(120);
    // engagement = likes + comments + shares + saves
    expect(m.engagement).toBe(185);
    expect(m.video_views).toBe(2200);
    // Rates are rounded to 4 decimals by design.
    expect(m.engagement_rate).toBeCloseTo(185 / 4000, 3);
  });

  it("prefers the platform-provided total_interactions", () => {
    const m = fromInstagram(
      { like_count: 10 },
      {
        data: [{ name: "total_interactions", values: [{ value: 99 }] }],
      },
    );
    expect(m.engagement).toBe(99);
  });

  it("falls back to reach when impressions are absent", () => {
    const m = fromInstagram(
      { like_count: 5 },
      {
        data: [{ name: "reach", values: [{ value: 800 }] }],
      },
    );
    expect(m.impressions).toBe(800);
    expect(m.engagement_rate).toBeCloseTo(5 / 800, 4);
  });

  it("survives an empty insights payload", () => {
    const m = fromInstagram({ like_count: 3, comments_count: 1 }, {});
    expect(m.engagement).toBe(4);
    expect(m.engagement_rate).toBe(0); // no denominator
  });

  it("does not divide by zero", () => {
    expect(fromInstagram({}, {}).engagement_rate).toBe(0);
  });
});

describe("fromInstagramAccount", () => {
  it("reads follower count and reach from total_value", () => {
    const r = fromInstagramAccount({
      data: [
        { name: "follower_count", total_value: { value: 5400 } },
        { name: "reach", total_value: { value: 12000 } },
      ],
    });
    expect(r.followers).toBe(5400);
    expect(r.reach).toBe(12000);
  });
});

describe("fromFacebook", () => {
  it("uses flattened summary counts", () => {
    const m = fromFacebook(
      { likes_count: 200, comments_count: 30, shares_count: 12 },
      {
        data: [
          { name: "post_impressions", values: [{ value: 9000 }] },
          { name: "post_impressions_unique", values: [{ value: 7000 }] },
          { name: "post_clicks", values: [{ value: 150 }] },
        ],
      },
    );
    expect(m.likes).toBe(200);
    expect(m.impressions).toBe(9000);
    expect(m.reach).toBe(7000);
    expect(m.clicks).toBe(150);
    expect(m.engagement).toBe(242);
  });

  it("falls back to engaged users when counters are missing", () => {
    const m = fromFacebook(
      {},
      {
        data: [{ name: "post_engaged_users", values: [{ value: 500 }] }],
      },
    );
    expect(m.engagement).toBe(500);
  });
});

describe("fromYouTube", () => {
  it("maps viewCount/likeCount/commentCount", () => {
    const m = fromYouTube(
      { viewCount: "10000", likeCount: "450", commentCount: "50" },
      { subscriberCount: "2300" },
    );
    expect(m.video_views).toBe(10000);
    expect(m.engagement).toBe(500);
    expect(m.followers).toBe(2300);
    expect(m.engagement_rate).toBeCloseTo(0.05, 4);
  });

  it("handles statistics hidden by the creator", () => {
    const m = fromYouTube({ viewCount: "1000", likeCount: undefined });
    expect(m.likes).toBe(0);
    expect(m.video_views).toBe(1000);
  });
});

describe("fromLinkedIn", () => {
  it("combines social actions and share statistics", () => {
    const m = fromLinkedIn({
      likeCount: 88,
      commentCount: 12,
      shareCount: 5,
      impressionCount: 5000,
      uniqueImpressionsCount: 4200,
      clickCount: 60,
    });
    expect(m.engagement).toBe(105);
    expect(m.reach).toBe(4200);
    expect(m.clicks).toBe(60);
    expect(m.engagement_rate).toBeCloseTo(105 / 5000, 4);
  });
});

describe("mergeCumulative", () => {
  it("takes the maximum, never the sum", () => {
    const merged = mergeCumulative(
      { likes: 10, impressions: 100 },
      { likes: 25, impressions: 100 },
    );
    expect(merged.likes).toBe(25);
    expect(merged.impressions).toBe(100);
  });

  it("protects history from a provider briefly reporting zero", () => {
    const merged = mergeCumulative({ likes: 50, reach: 900 }, { likes: 0, reach: 0 });
    expect(merged.likes).toBe(50);
    expect(merged.reach).toBe(900);
  });

  it("recomputes the rate after merging", () => {
    const merged = mergeCumulative(
      { engagement: 10, impressions: 100 },
      { engagement: 25, impressions: 50 },
    );
    expect(merged.engagement).toBe(25);
    expect(merged.impressions).toBe(100);
    expect(merged.engagement_rate).toBeCloseTo(0.25, 4);
  });

  it("starts from empty when there is no history", () => {
    const merged = mergeCumulative(EMPTY_METRICS, { likes: 7 });
    expect(merged.likes).toBe(7);
    expect(merged.saves).toBe(0);
  });
});
