/** Normalized fields we retain from a CSP violation. URLs must already be sanitized. */
export type CspViolation = {
  blockedURI: string | null;
  violatedDirective: string | null;
  effectiveDirective: string | null;
  documentURI: string | null;
  sourceFile: string | null;
  lineNumber: number | null;
  disposition: string | null;
};

/**
 * `audit_logs.resource_id` is UUID, whereas CSP directives are strings such as
 * `script-src-elem`. Keep the directive in metadata; do not cast it into the
 * UUID column, which causes every valid report to fail with PostgreSQL 22P02.
 */
export function toCspAuditRows(reports: CspViolation[], userAgent: string | null) {
  return reports.map((report) => ({
    action: "csp.violation",
    resource_type: "csp",
    user_agent: userAgent,
    metadata: { ...report, via: "csp-report" },
  }));
}
