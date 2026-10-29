import { describe, expect, it } from "vitest";

import {
  formatCspSummary,
  hostOf,
  suggestionFor,
  type CspReportSummary,
} from "@/lib/security/csp-summary";

/**
 * The decision this supports is binary — either the CSP can be enforced or it
 * cannot — so the analysis behind it has to be exact. Two things are easy to get
 * wrong and both are security-relevant:
 *
 *   1. echoing a value from `blocked-uri` into a directive, where a `;` would
 *      inject an extra directive;
 *   2. keeping the query string of the blocked URL, which is where the attacker
 *      puts the payload.
 */

describe("hostOf", () => {
  it("keeps scheme and host and drops path and query", () => {
    expect(hostOf("https://cdn.exemplo.com/foto.png?token=segredo")).toBe(
      "https://cdn.exemplo.com",
    );
    expect(hostOf("https://cdn.exemplo.com:8443/a/b")).toBe("https://cdn.exemplo.com:8443");
  });

  it("passes through CSP's own keywords", () => {
    expect(hostOf("inline")).toBe("inline");
    expect(hostOf("eval")).toBe("eval");
    expect(hostOf("data")).toBe("data");
  });

  it("returns null for nothing usable", () => {
    expect(hostOf(null)).toBeNull();
    expect(hostOf("")).toBeNull();
  });
});

describe("suggestionFor", () => {
  it("maps a -elem directive to the directive that actually needs the source", () => {
    expect(suggestionFor("script-src-elem", ["https://cdn.exemplo.com"])).toBe(
      "script-src https://cdn.exemplo.com",
    );
  });

  it("refuses to splice a value that could inject another directive", () => {
    const hostile = "https://evil.example; script-src 'unsafe-inline'";
    const suggestion = suggestionFor("img-src", [hostile]);
    expect(suggestion).not.toContain("script-src");
    expect(suggestion).toContain("sem host útil");
  });

  it("explains the inline case instead of suggesting a useless source", () => {
    const suggestion = suggestionFor("script-src-elem", ["inline"]);
    expect(suggestion).toContain("unsafe-inline");
  });
});

describe("formatCspSummary", () => {
  it("says it is safe when there is nothing collected", () => {
    const summary: CspReportSummary = {
      windowDays: 7,
      total: 0,
      directives: [],
      safeToEnforce: true,
    };
    expect(formatCspSummary(summary)).toContain("Seguro para CSP_MODE=enforce");
  });

  it("lists directives with a ready-to-paste suggestion", () => {
    const summary: CspReportSummary = {
      windowDays: 7,
      total: 3,
      directives: [
        {
          directive: "img-src",
          count: 3,
          hosts: ["https://cdn.exemplo.com"],
          suggestion: "img-src https://cdn.exemplo.com",
          lastSeen: "2026-10-29T00:00:00Z",
        },
      ],
      safeToEnforce: false,
    };
    const text = formatCspSummary(summary);
    expect(text).toContain("3 violações");
    expect(text).toContain("img-src https://cdn.exemplo.com");
  });
});
