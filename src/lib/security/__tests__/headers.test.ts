import { describe, expect, it } from "vitest";

import {
  buildCsp,
  cspHeaderName,
  isServerFnNavigation,
  isServerFnPath,
  nonceForRequest,
  randomNonce,
} from "@/lib/security/headers";

/**
 * These are the decisions that stand between a crafted URL and attacker HTML
 * running on our origin (GHSA-qx66-fv34-fjm8). They are pure functions over a
 * `Request`, so they are worth pinning exactly.
 */

function req(path: string, headers: Record<string, string> = {}, method = "GET"): Request {
  return new Request(`https://velt.app${path}`, { method, headers });
}

describe("isServerFnNavigation", () => {
  it("refuses every browser-shaped request to a server function", () => {
    expect(isServerFnNavigation(req("/_serverFn/abc", { accept: "text/html" }))).toBe(true);
    expect(isServerFnNavigation(req("/_serverFn/abc", { "sec-fetch-mode": "navigate" }))).toBe(
      true,
    );
    expect(isServerFnNavigation(req("/_serverFn/abc", { "sec-fetch-dest": "document" }))).toBe(
      true,
    );
    expect(isServerFnNavigation(req("/_serverFn/abc", { accept: "text/html" }, "POST"))).toBe(true);
  });

  it("lets the transport's own calls through", () => {
    const legitimate = req("/_serverFn/abc", {
      "x-tsr-serverFn": "true",
      accept: "text/html",
      "sec-fetch-mode": "cors",
    });
    expect(isServerFnNavigation(legitimate)).toBe(false);
  });

  it("ignores requests that land outside the transport", () => {
    expect(isServerFnNavigation(req("/", { accept: "text/html" }))).toBe(false);
    expect(isServerFnNavigation(req("/app/opportunities", { "sec-fetch-mode": "navigate" }))).toBe(
      false,
    );
  });

  it("does not reject a plain probe (no browser headers at all)", () => {
    // A monitoring client sends neither Accept: text/html nor Sec-Fetch-*; if
    // that were treated as an attack, uptime checks would report 404.
    expect(isServerFnNavigation(req("/_serverFn/abc"))).toBe(false);
  });
});

describe("isServerFnPath", () => {
  it("matches the transport prefix only", () => {
    expect(isServerFnPath(req("/_serverFn/abc"))).toBe(true);
    expect(isServerFnPath(req("/_serverFn"))).toBe(false);
    expect(isServerFnPath(req("/app"))).toBe(false);
  });
});

describe("nonceForRequest", () => {
  it("returns one stable value per request", () => {
    const request = req("/");
    const first = nonceForRequest(request);
    expect(nonceForRequest(request)).toBe(first);
    expect(first).toMatch(/^[0-9a-f]{32}$/);
  });

  it("never repeats across requests", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => nonceForRequest(req("/"))));
    expect(nonces.size).toBe(50);
  });

  it("is long enough to be unguessable", () => {
    expect(randomNonce()).toHaveLength(32);
  });
});

describe("buildCsp", () => {
  it("authorises only the nonce for scripts and blocks framing", () => {
    const csp = buildCsp("abc123", true);
    expect(csp).toContain("script-src 'self' 'nonce-abc123'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("'unsafe-inline'; script");
    expect(csp).toContain("report-uri /api/csp-report");
  });

  it("does not advertise a report endpoint when enforcing", () => {
    expect(buildCsp("abc123", false)).not.toContain("report-uri");
  });

  it("names the header according to the mode", () => {
    expect(cspHeaderName(true)).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeaderName(false)).toBe("Content-Security-Policy");
  });
});
