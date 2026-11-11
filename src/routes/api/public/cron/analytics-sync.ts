import { createFileRoute } from "@tanstack/react-router";
import { runAnalyticsSync } from "@/lib/analytics/sync.server";
import { handleCronPost } from "@/lib/security/cron-auth.server";

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" } as const;

export const Route = createFileRoute("/api/public/cron/analytics-sync")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleCronPost(request, {
          routeName: "analytics-sync",
          run: () => runAnalyticsSync(),
        }),
      GET: async () =>
        new Response(JSON.stringify({ error: "method_not_allowed" }), {
          status: 405,
          headers: { ...JSON_HEADERS, Allow: "POST" },
        }),
    },
  },
});
