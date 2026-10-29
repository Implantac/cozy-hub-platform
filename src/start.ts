import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";

import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * CSRF for the server-function transport.
 *
 * Server functions are same-origin RPC endpoints: every one of them runs with
 * the caller's session. Without this, a third-party page can post to
 * `/_serverFn/<id>` and the browser attaches the session cookie — the classic
 * confused-deputy shape. The framework's own middleware checks `Origin`,
 * `Sec-Fetch-Site` and (as fallback) `Referer`, which is stricter and more
 * accurate than a hand-rolled header check, so it is used instead of one.
 *
 * Scoped to the transport: normal page requests must keep working for callers
 * that legitimately arrive without those headers (bookmarks, older browsers).
 */
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
