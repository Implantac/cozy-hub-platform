import { createFileRoute } from "@tanstack/react-router";
import { resolveAndTrackClick } from "@/lib/bio/public.server";

/**
 * Public click-through endpoint: /bio/click/{linkId}
 *
 * Why a redirect instead of a direct link: it lets VELT count clicks without a
 * client-side beacon (blocked by many browsers) and without exposing the real
 * destination in the page HTML. The destination is read from the database by id,
 * never from a query parameter — a client-supplied target would make this an open
 * redirect.
 *
 * Cache-Control: no-store. A cached 302 would suppress every click after the
 * first and silently break the owner's analytics.
 */
export const Route = createFileRoute("/bio/click/$linkId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        let target: string | null;
        try {
          target = await resolveAndTrackClick(params.linkId, {
            referrer: request.headers.get("referer"),
            userAgent: request.headers.get("user-agent"),
          });
        } catch {
          // Service-role client unavailable (env not configured): the destination
          // is unknown, so there is nothing safe to redirect to.
          return new Response("Serviço temporariamente indisponível", {
            status: 503,
            headers: { "retry-after": "60", "cache-control": "no-store" },
          });
        }

        if (!target) {
          return new Response("Link não encontrado", {
            status: 404,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: target,
            "Cache-Control": "no-store, max-age=0",
            // Do not leak the bio slug to the destination site.
            "Referrer-Policy": "no-referrer",
          },
        });
      },
    },
  },
});
