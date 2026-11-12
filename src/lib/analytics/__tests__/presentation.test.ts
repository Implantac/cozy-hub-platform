import { describe, expect, it } from "vitest";
import { formatCollectionDate, formatMetric } from "../presentation";

describe("analytics presentation", () => {
  it("formats numbers using the selected language", () => {
    expect(formatMetric(1234, "pt-BR")).toBe("1.234");
    expect(formatMetric(1234, "en-US")).toBe("1,234");
  });
  it.each([NaN, Infinity, -Infinity])(
    "does not turn invalid metric %s into a reassuring zero",
    (value) => {
      expect(formatMetric(value, "pt-BR")).toBe("—");
    },
  );
  it("keeps collection dates on the UTC calendar day", () => {
    expect(formatCollectionDate("2026-11-12", "en-US")).toBe("Nov 12");
    expect(formatCollectionDate("2026-11-12", "pt-BR")).toContain("12");
  });
  it.each(["2026-02-30", "2026-13-01", "not-a-day"])(
    "does not silently invent a corrected date for %s",
    (day) => {
      expect(formatCollectionDate(day, "pt-BR")).toBe(day);
    },
  );
});
