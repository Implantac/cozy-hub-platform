import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

async function flags(portfolio?: string, google?: string) {
  vi.stubEnv("VITE_PORTFOLIO_MODE", portfolio);
  vi.stubEnv("VITE_GOOGLE_AUTH_ENABLED", google);
  vi.resetModules();
  return (await import("../flags")).FEATURES;
}

describe("portfolio presentation and optional sign-in readiness", () => {
  it("does not enable either behavior without explicit configuration", async () => {
    const result = await flags();
    expect(result.portfolio).toBe(false);
    expect(result.googleAuth).toBe(false);
  });
  it("keeps the portfolio label independent from Google sign-in", async () => {
    const result = await flags("true", "false");
    expect(result.portfolio).toBe(true);
    expect(result.googleAuth).toBe(false);
  });
  it("accepts explicit opt-in but fails closed on typos", async () => {
    expect((await flags("true", "true")).googleAuth).toBe(true);
    expect((await flags("yes", "yes")).googleAuth).toBe(false);
  });
});
