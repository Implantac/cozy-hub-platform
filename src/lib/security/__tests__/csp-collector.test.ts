import { describe, expect, it } from "vitest";
import { toCspAuditRows } from "@/lib/security/csp-collector";

describe("CSP audit writes", () => {
  it("stores a directive as metadata, not in the UUID resource_id column", () => {
    const rows = toCspAuditRows(
      [
        {
          blockedURI: "inline",
          violatedDirective: "script-src-elem",
          effectiveDirective: "script-src-elem",
          documentURI: "https://velt.app/",
          sourceFile: null,
          lineNumber: 228,
          disposition: "report",
        },
      ],
      "test browser",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("resource_id");
    expect(rows[0].metadata).toMatchObject({
      effectiveDirective: "script-src-elem",
      via: "csp-report",
    });
  });
});
