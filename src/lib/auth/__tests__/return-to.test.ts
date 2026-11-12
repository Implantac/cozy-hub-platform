import { describe, expect, it } from "vitest";
import { loginSearch, safeAppReturnTo } from "../return-to";

describe("safe post-login destination", () => {
  it.each([
    "/app",
    "/app/content",
    "/app/content?status=draft#composer",
    "/app/channels?oauth_error=denied",
  ])("preserves %s", (path) => {
    expect(safeAppReturnTo(path)).toBe(path);
  });
  it.each([
    undefined,
    null,
    12,
    "",
    "https://evil.example/app",
    "//evil.example/app",
    "/application",
    "/login",
    "javascript:alert(1)",
    "/app/../../login",
    "/app\\evil",
    "/app/%2f%2fevil",
    "/app/%5cevil",
    "/app/\ncontent",
    "/app/%0acontent",
    "/app/%ZZ",
  ])("rejects an unsafe destination: %s", (value) => {
    expect(safeAppReturnTo(value)).toBe("/app");
  });
  it("keeps reset-password mode without allowing other search keys", () => {
    expect(loginSearch({ mode: "reset", redirect: "/app/content", unwanted: "x" })).toEqual({
      mode: "reset",
      redirect: "/app/content",
    });
    expect(loginSearch({ redirect: "https://evil.example", mode: "unknown" })).toEqual({
      redirect: "/app",
    });
    expect(loginSearch({})).toEqual({});
  });
});
