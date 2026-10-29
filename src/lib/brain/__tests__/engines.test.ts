import { describe, expect, it } from "vitest";
import { analyzeGrowth } from "@/lib/brain/engines/growth.engine";
import { analyzeUser } from "@/lib/brain/engines/user.engine";
import type { BrainContext } from "@/lib/brain/types";

const NOW = Date.now();
const iso = (daysAgo: number) => new Date(NOW - daysAgo * 86400_000).toISOString();

function ctx(over: Partial<BrainContext> = {}): BrainContext {
  return {
    workspaceId: "00000000-0000-0000-0000-000000000001",
    userId: "00000000-0000-0000-0000-000000000002",
    profile: null,
    workspace: null,
    brands: [],
    channels: [],
    content: [],
    jobs: [],
    analytics: [],
    opportunities: [],
    memory: [],
    blueprint: null,
    competitors: [],
    skills: [],
    ...over,
  };
}

describe("growth engine — consistency", () => {
  it("raises a high-severity signal when publishing stopped", () => {
    const report = analyzeGrowth(
      ctx({ content: [{ id: "1", status: "published", created_at: iso(20), title: "Post" }] }),
    );
    const s = report.signals.find((x) => /últimos 7 dias/.test(x.message));
    expect(s).toBeDefined();
    expect(s?.severity).toBe("high");
    expect(report.actions.some((a) => a.href === "/app/content")).toBe(true);
  });

  it("praises a healthy cadence", () => {
    const content = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      status: "published" as const,
      created_at: iso(i % 5),
      title: `Post ${i}`,
    }));
    const report = analyzeGrowth(ctx({ content }));
    expect(report.signals.some((s) => s.kind === "positive")).toBe(true);
  });

  it("does not fire consistency alarms on an empty workspace", () => {
    const report = analyzeGrowth(ctx());
    expect(report.signals.some((s) => /últimos 7 dias/.test(s.message))).toBe(false);
  });
});

describe("growth engine — publish risk", () => {
  it("flags a low success rate and points to the scheduler", () => {
    const jobs = [
      { id: "1", status: "succeeded", scheduled_at: iso(2), content_id: "c1" },
      { id: "2", status: "failed", scheduled_at: iso(2), content_id: "c2" },
      { id: "3", status: "dead_letter", scheduled_at: iso(3), content_id: "c3" },
    ];
    const report = analyzeGrowth(ctx({ jobs: jobs as never }));
    expect(report.signals.some((s) => /Taxa de publicação/.test(s.message))).toBe(true);
    expect(report.actions.some((a) => a.href === "/app/scheduler")).toBe(true);
  });

  it("detects drafts that would fail the platform limits", () => {
    const report = analyzeGrowth(
      ctx({
        channels: [{ platform: "tiktok" } as never],
        content: [
          // TikTok requires media; a media-less draft can never be scheduled.
          { id: "d1", status: "draft", created_at: iso(1), title: "Sem mídia", body: "Texto" },
        ] as never,
      }),
    );
    expect(report.facts?.blockedDrafts).toBe(1);
    expect(report.actions.some((a) => a.title.includes("rascunhos"))).toBe(true);
  });

  it("reports the cadence target it derived", () => {
    const report = analyzeGrowth(ctx({ channels: [{ platform: "linkedin" } as never] }));
    expect(report.facts?.cadenceTarget).toBeGreaterThanOrEqual(2);
    expect(report.facts?.primaryPlatform).toBe("linkedin");
  });

  it("marks timing as baseline when there is no measured history", () => {
    const report = analyzeGrowth(ctx());
    expect(report.facts?.timingSource).toBe("baseline");
  });
});

describe("user engine", () => {
  it("prioritises the navigator when the profile is missing", () => {
    const report = analyzeUser(ctx());
    expect(report.facts?.hasProfile).toBe(false);
    expect(report.actions[0].href).toBe("/app/navigator");
    expect(report.actions[0].score).toBeGreaterThan(80);
  });

  it("warns about a very small weekly time budget", () => {
    const report = analyzeUser(
      ctx({
        profile: {
          experience_level: "beginner",
          time_budget_hours_week: 2,
          money_budget_monthly: 0,
          maturity_level: "seed",
          business_path: "affiliate",
          goals: [],
          preferred_channels: [],
        } as never,
      }),
    );
    expect(report.signals.some((s) => /2h\/semana/.test(s.message))).toBe(true);
    expect(report.facts?.complexity).toBe("low");
  });

  it("filters out paid strategies for a beginner without budget", () => {
    const report = analyzeUser(
      ctx({
        profile: {
          experience_level: "beginner",
          time_budget_hours_week: 5,
          money_budget_monthly: 0,
          maturity_level: "seed",
        } as never,
      }),
    );
    expect(report.signals.some((s) => /orgânicas/.test(s.message))).toBe(true);
  });

  it("surfaces weak skill areas when the map is populated", () => {
    const report = analyzeUser(
      ctx({
        profile: {
          experience_level: "intermediate",
          time_budget_hours_week: 8,
          money_budget_monthly: 200,
        } as never,
        skills: [
          { area: "copy", score: 20 },
          { area: "sales", score: 30 },
          { area: "branding", score: 15 },
        ] as never,
      }),
    );
    expect(report.facts?.weakAreas).toHaveLength(3);
    expect(report.signals.some((s) => /áreas com nível baixo/.test(s.message))).toBe(true);
  });
});

describe("growth engine — measured data (post analytics sync)", () => {
  it("switches timing to observed once snapshots exist", () => {
    // rankSlots needs BOTH >=2 samples per window AND >=6 measured posts in
    // total before it trusts personalisation. That is deliberate: two posts on
    // one weekday is coincidence, not a pattern. Model a realistic history of
    // six posts spread over two recurring windows.
    const days = [7, 14, 21, 9, 16, 23];
    const jobs = days.map((daysAgo, i) => ({
      id: String(i),
      status: "succeeded" as const,
      scheduled_at: iso(daysAgo),
      content_id: `c${i}`,
    }));
    const analytics = jobs.map((j, i) => ({
      id: `s${i}`,
      content_id: j.content_id,
      metrics: { engagement: 400, impressions: 4000 },
      captured_at: iso(1),
    }));
    const report = analyzeGrowth(
      ctx({
        channels: [{ platform: "instagram" } as never],
        jobs,
        analytics,
      }),
    );
    expect(report.facts?.timingSource).not.toBe("baseline");
    expect(report.facts?.measuredPosts).toBe(6);
  });

  it("flags a low measured engagement rate with an actionable fix", () => {
    const report = analyzeGrowth(
      ctx({
        channels: [{ platform: "instagram" } as never],
        jobs: [{ id: "1", status: "succeeded" as const, scheduled_at: iso(3), content_id: "c1" }],
        analytics: [
          { content_id: "c1", metrics: { engagement: 20, impressions: 5000 }, captured_at: iso(1) },
        ] as never,
      }),
    );
    const signal = report.signals.find((s) => /Engajamento médio/.test(s.message));
    expect(signal).toBeDefined();
    expect(signal?.kind).toBe("negative");
    expect(report.actions.some((a) => /gancho/i.test(a.title))).toBe(true);
  });

  it("praises a strong measured engagement rate", () => {
    const report = analyzeGrowth(
      ctx({
        channels: [{ platform: "instagram" } as never],
        jobs: [{ id: "1", status: "succeeded" as const, scheduled_at: iso(3), content_id: "c1" }],
        analytics: [
          {
            content_id: "c1",
            metrics: { engagement: 600, impressions: 5000 },
            captured_at: iso(1),
          },
        ] as never,
      }),
    );
    expect(report.signals.some((s) => /acima do padrão/.test(s.message))).toBe(true);
    expect(report.facts?.avgEngagementRate).toBeCloseTo(0.12, 3);
  });

  it("ignores snapshots without impressions to avoid divide-by-zero rates", () => {
    const report = analyzeGrowth(
      ctx({
        analytics: [{ content_id: "c1", metrics: { engagement: 10, impressions: 0 } }] as never,
      }),
    );
    expect(report.facts?.measuredPosts).toBe(0);
    expect(report.facts?.avgEngagementRate).toBeNull();
  });
});
