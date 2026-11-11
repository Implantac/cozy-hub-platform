/** Shared-secret authentication and HTTP handling for public cron routes. */
import { timingSafeEqual } from "node:crypto";

export type CronAuthResult = "authorized" | "unauthorized" | "not_configured";

const MIN_SECRET_LENGTH = 32;
const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

/**
 * The publishable Supabase key is public and must never authenticate a job that
 * can publish posts or call third-party APIs. Cron routes accept only this
 * server-only secret, with a minimum length to avoid weak deployment values.
 */
export function verifyCronRequest(
  request: Request,
  expectedSecret: string | undefined = process.env.CRON_SECRET,
): CronAuthResult {
  if (!expectedSecret || expectedSecret.length < MIN_SECRET_LENGTH) {
    return "not_configured";
  }

  const provided = request.headers.get("x-cron-secret");
  if (!provided) return "unauthorized";

  const expectedBytes = Buffer.from(expectedSecret, "utf8");
  const providedBytes = Buffer.from(provided, "utf8");
  if (expectedBytes.length !== providedBytes.length) return "unauthorized";

  try {
    return timingSafeEqual(expectedBytes, providedBytes) ? "authorized" : "unauthorized";
  } catch {
    return "unauthorized";
  }
}

/**
 * Shared POST handler keeps both public cron routes fail-closed in the same way.
 * The work callback is never invoked until the dedicated secret is verified.
 */
export async function handleCronPost<T extends object>(
  request: Request,
  options: {
    routeName: string;
    run: () => Promise<T>;
    expectedSecret?: string;
  },
): Promise<Response> {
  const auth = verifyCronRequest(request, options.expectedSecret);
  if (auth !== "authorized") {
    return new Response(
      JSON.stringify({
        error: auth === "not_configured" ? "cron_not_configured" : "unauthorized",
      }),
      { status: auth === "not_configured" ? 503 : 401, headers: JSON_HEADERS },
    );
  }

  try {
    const summary = await options.run();
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    console.error(`[cron/${options.routeName}] error:`, error);
    // Internal error details stay in server logs.
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
}
