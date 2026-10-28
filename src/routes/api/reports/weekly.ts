import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Node < 22 has no native WebSocket, and supabase-js constructs its Realtime
 * client eagerly — so `createClient` throws even though this route never touches
 * Realtime. Every other server module works around it individually; doing the
 * same here is what keeps this endpoint from returning 500 on Node 20.
 */
class InertWebSocket {
  constructor() {}
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

function realtimeTransport(): unknown {
  if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "function") return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const req = eval("require") as (id: string) => unknown;
    return req("ws") ?? InertWebSocket;
  } catch {
    return InertWebSocket;
  }
}
import { buildWeeklyReport, reportFilename } from "@/lib/reports/report.server";

/**
 * Authenticated download of the weekly report.
 *
 * Why a raw server route instead of a signed URL in a storage bucket: the PDF is
 * generated from live data on demand, and putting a client's numbers in a public
 * bucket to serve them once is how report leaks happen. Nothing is stored; the
 * bytes exist for the duration of the request.
 *
 * Auth: the `Authorization: Bearer <access_token>` header is verified against
 * Supabase, and every query afterwards runs with that token, so RLS decides what
 * the caller may read. A workspace the user does not belong to returns an empty
 * report rather than someone else's data.
 *
 * `?format=csv` returns the same numbers as CSV — the PDF is for reading, the
 * CSV is for checking.
 */
export const Route = createFileRoute("/api/reports/weekly")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const workspaceId = url.searchParams.get("workspaceId");
        const format = url.searchParams.get("format") === "csv" ? "csv" : "pdf";

        if (!workspaceId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) {
          return json({ error: "workspaceId inválido" }, 400);
        }

        const token = bearerToken(request.headers.get("authorization"));
        if (!token) return json({ error: "não autenticado" }, 401);

        const supabaseUrl = process.env.SUPABASE_URL;
        const anonKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
        if (!supabaseUrl || !anonKey) {
          // Never surface which variable is missing: this endpoint is reachable
          // from a browser and the message would name our infrastructure.
          return json({ error: "serviço indisponível" }, 503);
        }

        const transport = realtimeTransport();
        const supabase = createClient<Database>(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          ...(transport ? { realtime: { transport: transport as never } } : {}),
        });

        // `getClaims` THROWS on a malformed or expired token rather than
        // returning `{ error }`. Without this catch a bad token produced a 500
        // with the framework's HTML error page — wrong status, and it leaks that
        // the failure happened server-side rather than in the caller's session.
        let userId: string | null = null;
        try {
          const { data: claims, error: authError } = await supabase.auth.getClaims(token);
          if (!authError && claims?.claims?.sub) userId = String(claims.claims.sub);
        } catch {
          userId = null;
        }
        if (!userId) return json({ error: "sessão inválida" }, 401);

        try {
          const bundle = await buildWeeklyReport(supabase, workspaceId);
          const filename = reportFilename(bundle.data, format);

          if (format === "csv") {
            return new Response(bundle.csv, {
              status: 200,
              headers: {
                "content-type": "text/csv; charset=utf-8",
                "content-disposition": `attachment; filename="${filename}"`,
                "cache-control": "private, no-store",
              },
            });
          }

          return new Response(bundle.pdf as unknown as BodyInit, {
            status: 200,
            headers: {
              "content-type": "application/pdf",
              "content-disposition": `attachment; filename="${filename}"`,
              // The report contains a client's numbers. No intermediary, ever.
              "cache-control": "private, no-store",
              "x-content-type-options": "nosniff",
            },
          });
        } catch (e) {
          console.error("[reports] falha ao gerar:", e instanceof Error ? e.message : e);
          return json({ error: "não foi possível gerar o relatório" }, 500);
        }
      },
    },
  },
});

function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
