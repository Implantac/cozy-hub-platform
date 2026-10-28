import { describe, expect, it } from "vitest";
import {
  buildReportData,
  compareMetrics,
  defaultWindows,
  reportToCsv,
  sumMetrics,
  type PostMetrics,
  type PublishedPost,
  type ReportWindow,
} from "@/lib/reports/weekly";

/**
 * A weekly report arrives by email and is read away from the app. Every sentence
 * in it has to be literally true of the numbers printed next to it, and the same
 * input must always produce the same PDF. These tests pin both properties.
 */

const NOW = "2026-10-28T12:00:00.000Z";
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.parse(NOW) - daysAgo * DAY).toISOString();

const WINDOW: ReportWindow = { start: iso(7), end: iso(0) };
const PREV_WINDOW: ReportWindow = { start: iso(14), end: iso(7) };

function post(id: string, platform: string, daysAgo: number, title = `Post ${id}`): PublishedPost {
  return { contentId: id, title, platform, publishedAt: iso(daysAgo) };
}

function metrics(id: string, m: Partial<PostMetrics["metrics"]>): PostMetrics {
  return { contentId: id, metrics: m };
}

describe("sumMetrics", () => {
  it("sums numeric fields and ignores junk", () => {
    const total = sumMetrics([
      metrics("a", { impressions: 100, engagement: 10 }),
      metrics("b", { impressions: 50, engagement: 5 }),
      // A malformed payload must not produce NaN on a client's report.
      { contentId: "c", metrics: { impressions: NaN, engagement: 3 } },
    ]);
    expect(total.impressions).toBe(150);
    expect(total.engagement).toBe(18);
  });

  it("derives the rate instead of summing percentages", () => {
    // Adding 10% + 10% would give 20%, which is not a rate.
    const total = sumMetrics([
      metrics("a", { impressions: 100, engagement: 10, engagement_rate: 10 }),
      metrics("b", { impressions: 100, engagement: 10, engagement_rate: 10 }),
    ]);
    expect(total.engagement_rate).toBeCloseTo(0.1, 4);
  });

  it("returns a zero rate instead of dividing by zero", () => {
    expect(sumMetrics([metrics("a", { engagement: 5 })]).engagement_rate).toBe(0);
  });
});

describe("compareMetrics", () => {
  it("computes the percentage change against the previous week", () => {
    const m = compareMetrics(
      { ...sumMetrics([]), impressions: 150, engagement: 30 } as never,
      { ...sumMetrics([]), impressions: 100, engagement: 30 } as never,
    );
    const impressions = m.find((x) => x.key === "impressions");
    expect(impressions?.deltaPct).toBe(50);
    expect(impressions?.direction).toBe("up");
    const engagement = m.find((x) => x.key === "engagement");
    expect(engagement?.direction).toBe("flat");
  });

  it("returns null — not Infinity or 100% — when there is no previous value", () => {
    const m = compareMetrics(
      { ...sumMetrics([]), impressions: 500 } as never,
      { ...sumMetrics([]), impressions: 0 } as never,
    );
    const impressions = m.find((x) => x.key === "impressions");
    // "∞%" is not something a person reads; the renderer shows "novo" instead.
    expect(impressions?.deltaPct).toBeNull();
    expect(impressions?.current).toBe(500);
  });
});

describe("buildReportData", () => {
  it("counts publications inside each window, not just in total", () => {
    const data = buildReportData({
      workspaceName: "Padaria Vila Nova",
      window: WINDOW,
      previousWindow: PREV_WINDOW,
      published: [
        post("a", "instagram", 2),
        post("b", "instagram", 5),
        post("c", "instagram", 9), // previous week
      ],
      metricsCurrent: [],
      metricsPrevious: [],
      now: NOW,
    });
    expect(data.publishedCount).toBe(2);
    expect(data.previousPublishedCount).toBe(1);
  });

  it("ranks channels by engagement", () => {
    const data = buildReportData({
      workspaceName: "X",
      window: WINDOW,
      previousWindow: PREV_WINDOW,
      published: [post("a", "instagram", 1), post("b", "facebook", 2)],
      metricsCurrent: [
        metrics("a", { engagement: 5, impressions: 100 }),
        metrics("b", { engagement: 40, impressions: 100 }),
      ],
      metricsPrevious: [],
      now: NOW,
    });
    expect(data.channels[0].platform).toBe("facebook");
    expect(data.channels[0].engagement).toBe(40);
  });

  it("keeps the top posts to three and drops posts with no engagement", () => {
    const published = ["a", "b", "c", "d", "e"].map((id, i) => post(id, "instagram", i + 1));
    const data = buildReportData({
      workspaceName: "X",
      window: WINDOW,
      previousWindow: PREV_WINDOW,
      published,
      metricsCurrent: [
        metrics("a", { engagement: 1 }),
        metrics("b", { engagement: 10 }),
        metrics("c", { engagement: 5 }),
        metrics("d", { engagement: 20 }),
        metrics("e", { engagement: 0 }),
      ],
      metricsPrevious: [],
      now: NOW,
    });
    expect(data.topPosts).toHaveLength(3);
    expect(data.topPosts.map((p) => p.title)).toEqual(["Post d", "Post b", "Post c"]);
  });

  it("says plainly when there was no activity instead of showing an empty chart", () => {
    const data = buildReportData({
      workspaceName: "X",
      window: WINDOW,
      previousWindow: PREV_WINDOW,
      published: [],
      metricsCurrent: [],
      metricsPrevious: [],
      now: NOW,
    });
    expect(data.empty).toBe(true);
    expect(data.highlights[0]).toContain("Nenhuma publicação nesta semana");
  });

  it("warns when posts went out but no impressions were collected", () => {
    const data = buildReportData({
      workspaceName: "X",
      window: WINDOW,
      previousWindow: PREV_WINDOW,
      published: [post("a", "instagram", 1)],
      metricsCurrent: [metrics("a", { engagement: 0, impressions: 0 })],
      metricsPrevious: [metrics("z", { impressions: 10 })],
      now: NOW,
    });
    // This is the most actionable sentence in the whole report: the failure is
    // in the integration, not in the content.
    expect(data.highlights.join(" ")).toContain("conexão do canal");
  });

  it("is deterministic: identical input produces an identical report", () => {
    const input = {
      workspaceName: "X",
      window: WINDOW,
      previousWindow: PREV_WINDOW,
      published: [post("a", "instagram", 1)],
      metricsCurrent: [metrics("a", { impressions: 100, engagement: 10 })],
      metricsPrevious: [],
      now: NOW,
    };
    const a = buildReportData(input);
    const b = buildReportData(input);
    // The PDF carries a hash of this payload; a non-deterministic build would
    // make the hash useless as proof of what was sent.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("defaultWindows", () => {
  it("produces two adjacent 7-day windows ending now", () => {
    const { window, previousWindow } = defaultWindows(new Date(NOW));
    expect(Date.parse(window.end) - Date.parse(window.start)).toBe(7 * DAY);
    expect(Date.parse(previousWindow.end)).toBe(Date.parse(window.start));
    expect(Date.parse(previousWindow.end) - Date.parse(previousWindow.start)).toBe(7 * DAY);
  });
});

describe("reportToCsv", () => {
  it("escapes titles containing commas and quotes", () => {
    const data = buildReportData({
      workspaceName: "X",
      window: WINDOW,
      previousWindow: PREV_WINDOW,
      published: [post("a", "instagram", 1, 'Promoção "imperdível", só hoje')],
      metricsCurrent: [metrics("a", { engagement: 5, impressions: 10 })],
      metricsPrevious: [],
      now: NOW,
    });
    const csv = reportToCsv(data);
    expect(csv).toContain('"Promoção ""imperdível"", só hoje"');
    // A stray quote would break every row after it in a spreadsheet.
    expect(csv.split("\n").every((line) => (line.match(/"/g) ?? []).length % 2 === 0)).toBe(true);
  });

  it("leaves the delta empty when there is no comparison base", () => {
    const data = buildReportData({
      workspaceName: "X",
      window: WINDOW,
      previousWindow: PREV_WINDOW,
      published: [],
      metricsCurrent: [metrics("a", { impressions: 10 })],
      metricsPrevious: [],
      now: NOW,
    });
    const csv = reportToCsv(data);
    expect(csv).toContain("Impressões,10,0,");
  });
});
