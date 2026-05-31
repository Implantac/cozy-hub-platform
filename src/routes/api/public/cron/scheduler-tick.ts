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
        const provided = request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected) {
          return new Response(
            JSON.stringify({ error: "CRON_SECRET not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        if (!provided || provided !== expected) {
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
