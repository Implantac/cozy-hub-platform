import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  signState,
  verifyState,
  stateCookieName,
  stateCookieValue,
  stateMatchesCookie,
} from "../state.server";
const input = {
  workspaceId: "10000000-0000-4000-8000-000000000001",
  userId: "10000000-0000-4000-8000-000000000002",
  provider: "facebook",
  redirectUri: "https://velt.example/api/public/oauth/callback/facebook",
};
beforeEach(() => {
  vi.stubEnv("OAUTH_TOKEN_ENC_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
describe("OAuth signed state and browser binding", () => {
  it("roundtrips only validated state with independent nonces", () => {
    const a = signState(input),
      b = signState(input);
    expect(a).not.toBe(b);
    expect(verifyState(a)).toMatchObject(input);
  });
  it("requires the correct per-provider browser cookie without disclosing the state payload", () => {
    const state = signState(input);
    const value = stateCookieValue(state);
    expect(value).toMatch(/^[a-f0-9]{64}$/);
    expect(value).not.toContain(input.workspaceId);
    expect(stateMatchesCookie(state, value)).toBe(true);
    expect(stateMatchesCookie(state, undefined)).toBe(false);
    expect(stateMatchesCookie(signState(input), value)).toBe(false);
    expect(stateMatchesCookie(state, "short")).toBe(false);
  });
  it("rejects expiry at the exact boundary", () => {
    const state = signState(input);
    vi.advanceTimersByTime(600000);
    expect(() => verifyState(state)).toThrow("expired");
  });
  it.each(["", "a", "a.b.c", "a.", ".".repeat(5000)])("rejects malformed state %j", (state) => {
    expect(() => verifyState(state)).toThrow();
  });
  it("rejects tampering and invalid key length", () => {
    const state = signState(input);
    expect(() => verifyState(state.slice(0, -1) + (state.endsWith("a") ? "b" : "a"))).toThrow();
    vi.stubEnv("OAUTH_TOKEN_ENC_KEY", "short");
    expect(() => signState(input)).toThrow("32-byte");
  });
  it("validates payload shape and cookie provider names before signing", () => {
    expect(() => signState({ ...input, workspaceId: "bad" })).toThrow();
    expect(() => stateCookieName("../facebook")).toThrow();
    expect(stateCookieName("google_business")).toBe("velt_oauth_google_business");
  });
});
