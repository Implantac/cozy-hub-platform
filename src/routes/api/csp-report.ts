/**
 * CSP violation reports.
 *
 * The policy ships as `Content-Security-Policy-Report-Only` (see
 * `buildCsp`), and that only pays off if the reports are actually collected:
 * without them, flipping to `CSP_MODE=enforce` is a guess. This endpoint is the
 * thing that turns the Report-Only period into evidence.
 *
 * Threat model — this endpoint is **public and unauthenticated**, by necessity:
 * browsers post to it with no credentials. So:
 *
 *   - body capped (`MAX_BODY_BYTES`): an anonymous POST must not be able to make
 *     the server buffer megabytes of JSON;
 *   - only the fields the spec defines are read, everything else dropped;
 *   - the URL is stored **without query string**, because the whole point of a
 *     report is that the URL was attacker-influenced. Persisting a full attacker
 *     URL puts it in our logs and dashboards — the same mistake the XSS advisory
 *     is about, one layer down;
 *   - every write is best-effort: a broken database must not make a browser
 *     retry, and a monitoring client must still get 204;
 *   - per-IP throttle so one caller cannot flood the table.
 *
 * Rate limiting is in-process. That is honest for a single runtime and wrong for
 * a multi-instance deployment — Cloudflare Workers gives each isolate its own
 * memory. It raises the cost of a flood; it is not a guarantee. The durable
 * answer belongs in the WAF or a shared store.
 */

import { createFileRoute } from "@tanstack/react-router";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_REPORTS_PER_BODY = 5;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

type Violation = {
  blockedURI: string | null;
  violatedDirective: string | null;
  effectiveDirective: string | null;
  documentURI: string | null;
  sourceFile: string | null;
  lineNumber: number | null;
  disposition: string | null;
};

/**
 * Per-isolate request counter, keyed by IP.
 *
 * A `Map` is used rather than an LRU on purpose: the entry count is bounded by
 * the sweep below, and an unbounded map on a public endpoint is itself the
 * memory leak this is meant to prevent.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

function overLimit(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 5_000) {
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }
  const entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

/** Trims a URL to origin + path. The query string is where tokens and payloads live. */
function stripQuery(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    // Not a URL (a bare filename in `source-file`, for instance). Keep a short
    // prefix: useful for debugging, too short to carry a payload.
    return value.slice(0, 200);
  }
}

function asString(value: unknown, max = 512): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, max) : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Reads one `application/csp-report` (the legacy shape, nesting everything under
 * `csp-report`) or `application/reports+json` (an array of `{ type, body }`).
 */
function parseReports(raw: unknown): Violation[] {
  const items = Array.isArray(raw) ? raw : [raw];
  const out: Violation[] = [];

  for (const item of items.slice(0, MAX_REPORTS_PER_BODY)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;

    // `reports+json` wraps the payload in `body`; the legacy format nests it in
    // `csp-report`. Support both, since browsers differ.
    const body =
      record.body && typeof record.body === "object"
        ? (record.body as Record<string, unknown>)
        : record["csp-report"] && typeof record["csp-report"] === "object"
          ? (record["csp-report"] as Record<string, unknown>)
          : record;

    const violated = asString(body["violated-directive"]);
    const effective = asString(body["effective-directive"]);
    const blocked = asString(body["blocked-uri"]);

    // A report with no directive tells us nothing we can act on.
    if (!violated && !effective) continue;

    out.push({
      blockedURI: blocked,
      violatedDirective: violated,
      effectiveDirective: effective,
      documentURI: stripQuery(asString(body["document-uri"])),
      sourceFile: stripQuery(asString(body["source-file"])),
      lineNumber: asNumber(body["line-number"]),
      disposition: asString(body.disposition, 32),
    });
  }

  return out;
}

export const Route = createFileRoute("/api/csp-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";

        if (overLimit(ip)) {
          return new Response(null, { status: 429, headers: { "retry-after": "60" } });
        }

        // Reject oversized bodies before parsing: `await request.text()` on an
        // unbounded public POST is a cheap way to exhaust memory.
        const declared = Number(request.headers.get("content-length") ?? "0");
        if (declared > MAX_BODY_BYTES) {
          return new Response(null, { status: 413 });
        }

        let parsed: unknown;
        try {
          const text = await request.text();
          if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
          parsed = JSON.parse(text);
        } catch {
          // Browsers ignore the response; a 204 keeps their consoles quiet, and
          // malformed bodies are not worth a log line each.
          return new Response(null, { status: 204 });
        }

        const reports = parseReports(parsed);
        if (reports.length === 0) return new Response(null, { status: 204 });

        // Persist, and be honest when it fails.
        //
        // Best-effort is right for the browser — it never reads this response —
        // but silently swallowing the failure is not: the collector then reports
        // "no violations", which reads exactly like "the policy is clean". That
        // is the one way this endpoint can lie, so a failed write is logged *and*
        // answered with 500.
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("audit_logs").insert(
            reports.map((report) => ({
              action: "csp.violation",
              resource_type: "csp",
              resource_id: report.violatedDirective ?? report.effectiveDirective,
              user_agent: asString(request.headers.get("user-agent"), 400),
              metadata: {
                ...report,
                // Not the IP: it identifies a person and adds nothing to a
                // policy decision. The count is what matters.
                via: "csp-report",
              },
            })),
          );
          if (error) throw error;
        } catch (error) {
          console.error(
            "[csp-report] persist failed — as violações NÃO foram registradas e " +
              "o relatório de enforcement vai mentir:",
            error,
          );
          return new Response(null, { status: 500 });
        }

        return new Response(null, { status: 204 });
      },
      // Browsers only POST here. Answering other methods keeps scanners from
      // learning whether the route exists by status alone.
      GET: async () => new Response(null, { status: 405, headers: { allow: "POST" } }),
    },
  },
});
