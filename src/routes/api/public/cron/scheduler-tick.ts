import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { runSchedulerTick } from "@/lib/scheduler/dispatcher.server";

/**
 * Public cron endpoint hit by pg_cron every minute.
 *
 * Auth: shared-secret header `x-cron-secret` must match process.env.CRON_SECRET,
 * or `apikey` header must match the Supabase publishable/anon key (used by pg_cron).
 * Even though /api/public/* bypasses Lovable's edge auth, this handler enforces
 * its own gate before doing anything.
 */
function safeEqual(a: string | null, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Length comparison must be guarded — timingSafeEqual throws on length mismatch.
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export const Route = createFileRoute("/api/public/cron/scheduler-tick")({
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
          const summary = await runSchedulerTick({ limit: 20, lockSeconds: 60 });
          return new Response(JSON.stringify({ ok: true, ...summary }), {
            status: 200,
            headers: JSON_HEADERS,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[cron/scheduler-tick] error:", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: JSON_HEADERS,
          });
        }
      },
      // Do not leak the expected header name on unauthenticated GETs.
      GET: async () =>
        new Response(JSON.stringify({ error: "method_not_allowed" }), {
          status: 405,
          headers: { ...JSON_HEADERS, Allow: "POST" },
        }),
    },
  },
});
