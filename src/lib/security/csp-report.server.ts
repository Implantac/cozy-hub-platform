/**
 * Reading back the collected CSP violations, to decide whether the policy can be
 * enforced.
 *
 * A Report-Only policy produces data only if someone looks at it. This turns the
 * rows `csp-report` writes into the single question that matters: *which
 * directive would break, and for which resource host* — sorted by how often it
 * happens, so the one blocking change surfaces first.
 *
 * Server-only: it reads `audit_logs` with the service role, so it must never be
 * reachable from the browser (RLS does not protect it — the service role
 * bypasses RLS on purpose).
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { hostOf, suggestionFor, type DirectiveSummary, type CspReportSummary } from "./csp-summary";

export type { CspReportSummary, DirectiveSummary };

/**
 * Summarises violations from the last `windowDays` days.
 *
 * `limit` bounds the rows read; the table is written by an unauthenticated
 * endpoint, so it can grow in ways we do not control and this must stay cheap.
 */
export async function summarizeCspViolations(
  windowDays = 7,
  limit = 5_000,
): Promise<CspReportSummary> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("audit_logs")
    .select("created_at, metadata")
    .eq("action", "csp.violation")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const byDirective = new Map<
    string,
    { count: number; hosts: Map<string, number>; last: string }
  >();

  for (const row of data ?? []) {
    const meta = row.metadata;
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) continue;
    const record = meta as Record<string, unknown>;

    const directive =
      typeof record.effectiveDirective === "string" && record.effectiveDirective.length > 0
        ? record.effectiveDirective
        : typeof record.violatedDirective === "string"
          ? record.violatedDirective.split(" ")[0]
          : null;
    if (!directive) continue;

    const host = hostOf(typeof record.blockedURI === "string" ? record.blockedURI : null);
    const entry = byDirective.get(directive) ?? {
      count: 0,
      hosts: new Map(),
      last: row.created_at,
    };
    entry.count += 1;
    if (host) entry.hosts.set(host, (entry.hosts.get(host) ?? 0) + 1);
    if (row.created_at > entry.last) entry.last = row.created_at;
    byDirective.set(directive, entry);
  }

  const directives: DirectiveSummary[] = [...byDirective.entries()]
    .map(([directive, entry]) => {
      const hosts = [...entry.hosts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([host]) => host);
      return {
        directive,
        count: entry.count,
        hosts,
        suggestion: suggestionFor(directive, hosts),
        lastSeen: entry.last,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    windowDays,
    total: directives.reduce((sum, d) => sum + d.count, 0),
    directives,
    safeToEnforce: directives.length === 0,
  };
}
