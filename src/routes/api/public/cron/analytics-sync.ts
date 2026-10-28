import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { runAnalyticsSync } from "@/lib/analytics/sync.server";

/**
 * Public cron endpoint for metric collection.
 *
 * Mirrors the scheduler-tick gate: shared secret in `x-cron-secret`, or the
 * Supabase publishable key in `apikey` (used by pg_cron). /api/public/* bypasses
 * edge auth, so the handler authenticates itself.
 *
 * Recommended cadence: every 6 hours. Platform insight endpoints are quota-bound
 * and per-post counters plateau within a day; hourly polling burns quota for no
 * extra signal.
 */
function safeEqual(a: string | null, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export const Route = createFileRoute("/api/public/cron/analytics-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const providedSecret = request.headers.get("x-cron-secret");
        const providedApiKey = request.headers.get("apikey");
        const expectedSecret = process.env.CRON_SECRET ?? null;
        const expectedApiKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;

        const ok =
          safeEqual(expectedSecret, providedSecret) || safeEqual(expectedApiKey, providedApiKey);

        if (!ok) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: JSON_HEADERS,
          });
        }

        try {
          const summary = await runAnalyticsSync();
          return new Response(JSON.stringify({ ok: true, ...summary }), {
            status: 200,
            headers: JSON_HEADERS,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[cron/analytics-sync] error:", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: JSON_HEADERS,
          });
        }
      },
      GET: async () =>
        new Response(JSON.stringify({ error: "method_not_allowed" }), {
          status: 405,
          headers: { ...JSON_HEADERS, Allow: "POST" },
        }),
    },
  },
});
