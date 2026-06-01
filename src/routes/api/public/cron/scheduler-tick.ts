import { createFileRoute } from "@tanstack/react-router";
import { runSchedulerTick } from "@/lib/scheduler/dispatcher.server";

/**
 * Public cron endpoint hit by pg_cron every minute.
 *
 * Auth: shared-secret header `x-cron-secret` must match process.env.CRON_SECRET.
 * Even though /api/public/* bypasses Lovable's edge auth, this handler enforces
 * its own gate before doing anything.
 */
export const Route = createFileRoute("/api/public/cron/scheduler-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Accept either x-cron-secret (CRON_SECRET) or apikey (Supabase anon key).
        const providedSecret = request.headers.get("x-cron-secret");
        const providedApiKey = request.headers.get("apikey");
        const expectedSecret = process.env.CRON_SECRET;
        const expectedApiKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

        const secretOk =
          !!expectedSecret && !!providedSecret && providedSecret === expectedSecret;
        const apiKeyOk =
          !!expectedApiKey && !!providedApiKey && providedApiKey === expectedApiKey;

        if (!secretOk && !apiKeyOk) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const summary = await runSchedulerTick({ limit: 20, lockSeconds: 60 });
          return new Response(JSON.stringify({ ok: true, ...summary }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[cron/scheduler-tick] error:", message);
          return new Response(
            JSON.stringify({ ok: false, error: message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async () =>
        new Response(JSON.stringify({ ok: true, hint: "POST with x-cron-secret" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});
