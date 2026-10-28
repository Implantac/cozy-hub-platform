import { describe, expect, it } from "vitest";
import {
  cadenceTarget,
  formatSlotLabel,
  localSlot,
  nextBestSlot,
  rankSlots,
  toUtcHour,
  type SlotObservation,
} from "@/lib/growth/scheduling";

/** Builds an ISO instant for a given UTC-3 local weekday/hour, `weeksAgo` back. */
function localIso(weekday: number, localHour: number, weeksAgo = 1): string {
  // 2026-10-25 is a Sunday (weekday 0).
  const base = new Date(Date.UTC(2026, 9, 25, 0, 0, 0));
  const utcHour = toUtcHour(localHour);
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + weekday - 7 * weeksAgo);
  d.setUTCHours(utcHour, 0, 0, 0);
  return d.toISOString();
}

describe("timezone handling", () => {
  it("round-trips local hour through UTC", () => {
    expect(toUtcHour(9)).toBe(12);
    expect(toUtcHour(21)).toBe(0);
    expect(toUtcHour(0)).toBe(3);
  });

  it("derives the local slot from an ISO instant", () => {
    const iso = localIso(3, 19);
    const slot = localSlot(iso);
    expect(slot.weekday).toBe(3);
    expect(slot.hour).toBe(19);
  });

  it("formats slot labels in local time", () => {
    expect(formatSlotLabel(1, toUtcHour(11))).toBe("seg 11:00");
  });
});

describe("rankSlots", () => {
  it("falls back to baseline with no history and says so", () => {
    const ranked = rankSlots("instagram", []);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((r) => r.confidence === "baseline")).toBe(true);
    expect(ranked[0].reason).toContain("sem histórico");
  });

  it("uses observed data once there is enough history", () => {
    const observations: SlotObservation[] = [
      // Wednesday 19:00 — consistently strong
      { publishedAt: localIso(3, 19, 1), engagement: 400, impressions: 4000 },
      { publishedAt: localIso(3, 19, 2), engagement: 520, impressions: 4000 },
      { publishedAt: localIso(3, 19, 3), engagement: 480, impressions: 4000 },
      // Monday 11:00 — weak
      { publishedAt: localIso(1, 11, 1), engagement: 20, impressions: 4000 },
      { publishedAt: localIso(1, 11, 2), engagement: 30, impressions: 4000 },
      { publishedAt: localIso(1, 11, 3), engagement: 25, impressions: 4000 },
    ];
    const ranked = rankSlots("instagram", observations);
    expect(ranked[0].confidence).toBe("observed");
    expect(ranked[0].weekday).toBe(3);
    expect(ranked[0].score).toBe(1); // normalised best
    expect(ranked[0].samples).toBe(3);
  });

  it("normalises by impressions when available", () => {
    // Same raw engagement but far more impressions => lower rate => worse slot.
    const observations: SlotObservation[] = [
      { publishedAt: localIso(2, 10, 1), engagement: 100, impressions: 1000 },
      { publishedAt: localIso(2, 10, 2), engagement: 100, impressions: 1000 },
      { publishedAt: localIso(4, 10, 1), engagement: 300, impressions: 30000 },
      { publishedAt: localIso(4, 10, 2), engagement: 300, impressions: 30000 },
      { publishedAt: localIso(5, 10, 1), engagement: 50, impressions: 1000 },
      { publishedAt: localIso(5, 10, 2), engagement: 50, impressions: 1000 },
    ];
    const ranked = rankSlots("instagram", observations);
    expect(ranked[0].weekday).toBe(2);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("ignores slots backed by a single sample", () => {
    const observations: SlotObservation[] = [
      { publishedAt: localIso(0, 8, 1), engagement: 9999 },
      { publishedAt: localIso(2, 15, 1), engagement: 10 },
      { publishedAt: localIso(2, 15, 2), engagement: 12 },
      { publishedAt: localIso(3, 15, 1), engagement: 11 },
      { publishedAt: localIso(3, 15, 2), engagement: 13 },
      { publishedAt: localIso(4, 15, 1), engagement: 9 },
      { publishedAt: localIso(4, 15, 2), engagement: 14 },
    ];
    const ranked = rankSlots("instagram", observations);
    expect(ranked.every((r) => r.samples >= 2)).toBe(true);
  });
});

describe("nextBestSlot", () => {
  it("always returns a future instant with the required lead time", () => {
    const from = new Date("2026-10-28T12:00:00.000Z");
    const slot = nextBestSlot("instagram", [], from, 30);
    expect(new Date(slot.at).getTime()).toBeGreaterThanOrEqual(from.getTime() + 30 * 60_000);
    expect(slot.label).toBeTruthy();
  });

  it("respects observed preferences when history exists", () => {
    const observations: SlotObservation[] = [
      ...Array.from({ length: 3 }, (_, i) => ({
        publishedAt: localIso(4, 20, i + 1),
        engagement: 900,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        publishedAt: localIso(1, 9, i + 1),
        engagement: 10,
      })),
    ];
    const from = new Date("2026-10-25T13:00:00.000Z"); // Sunday
    const slot = nextBestSlot("instagram", observations, from);
    expect(slot.confidence).toBe("observed");
    // Thursday 20:00 local = 23:00 UTC
    expect(new Date(slot.at).getUTCDay()).toBe(4);
    expect(new Date(slot.at).getUTCHours()).toBe(23);
  });

  it("is stable across repeated calls with the same reference date", () => {
    const from = new Date("2026-10-28T12:00:00.000Z");
    expect(nextBestSlot("linkedin", [], from).at).toBe(nextBestSlot("linkedin", [], from).at);
  });
});

describe("cadenceTarget", () => {
  it("scales down for very low time budgets", () => {
    const t = cadenceTarget("instagram", { time_budget_hours_week: 2 });
    expect(t.perWeek).toBe(2);
    expect(t.source).toBe("profile");
    expect(t.rationale).toContain("2h");
  });

  it("scales up for high time budgets", () => {
    expect(cadenceTarget("instagram", { time_budget_hours_week: 12 }).perWeek).toBe(7);
  });

  it("is conservative for beginners without a profile", () => {
    const t = cadenceTarget("tiktok", null);
    expect(t.perWeek).toBeGreaterThanOrEqual(2);
    expect(t.source).toBe("platform-default");
  });
});
