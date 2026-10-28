import { describe, expect, it } from "vitest";
import { needsRefresh } from "@/lib/oauth/refresh.server";

describe("needsRefresh", () => {
  const now = new Date("2026-10-28T12:00:00.000Z").getTime();

  it("treats an unknown expiry as valid", () => {
    expect(needsRefresh(null, now)).toBe(false);
    expect(needsRefresh(undefined, now)).toBe(false);
  });

  it("refreshes tokens expiring within the 5-minute skew window", () => {
    expect(needsRefresh(new Date(now + 2 * 60_000).toISOString(), now)).toBe(true);
    expect(needsRefresh(new Date(now - 60_000).toISOString(), now)).toBe(true);
  });

  it("keeps tokens that are comfortably valid", () => {
    expect(needsRefresh(new Date(now + 60 * 60_000).toISOString(), now)).toBe(false);
  });

  it("ignores malformed expiry instead of crashing the dispatch", () => {
    expect(needsRefresh("not-a-date", now)).toBe(false);
  });
});
