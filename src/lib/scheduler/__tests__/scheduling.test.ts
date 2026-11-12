import { describe, it, expect } from "vitest";
import { futureScheduleIso, localDateTime } from "../scheduling";
const now = new Date(2026, 10, 12, 12, 0).getTime();
describe("local scheduling input", () => {
  it("converts the browser-local wall time to UTC and roundtrips", () => {
    const value = "2026-11-13T16:30";
    const iso = futureScheduleIso(value, now);
    expect(iso).toBe(new Date(2026, 10, 13, 16, 30).toISOString());
    expect(localDateTime(new Date(iso!))).toBe(value);
  });
  it.each([
    "",
    "invalid",
    "2026-11-12",
    "2026-02-30T12:00",
    "2026-11-12T12:00",
    "2026-11-11T23:59",
    "2026-13-30T12:00",
    "2026-11-13T25:00",
  ])("rejects malformed, normalized or nonfuture input %s", (value) => {
    expect(futureScheduleIso(value, now)).toBeNull();
  });
});
