import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  buildCsp,
  cspHeaderName,
  isServerFnNavigation,
  isServerFnPath,
  nonceForRequest,
  serverFnRefusalResponse,
} from "./lib/security/headers";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

/**
 * Enforces a CSP in blocking mode, or ships it as report-only.
 *
 * Opt in with `CSP_MODE=enforce`. Until then the policy is emitted as
 * `Content-Security-Policy-Report-Only`: a wrong directive in a blocking policy
 * does not look like a policy bug, it looks like the app is broken, and this
 * deployment serves real traffic.
 */
const REPORT_ONLY = process.env.CSP_MODE !== "enforce";

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * Adds the CSP to a response, leaving anything the runtime already set alone.
 */
function withSecurityHeaders(response: Response, nonce: string): Response {
  // A redirect or a streamed body may carry immutable headers; clone defensively
  // by constructing a new Response only when the body is absent, otherwise set on
  // the existing headers object (Headers is mutable in every supported runtime).
  try {
    response.headers.set(cspHeaderName(REPORT_ONLY), buildCsp(nonce, REPORT_ONLY));
    response.headers.set("x-content-type-options", "nosniff");
    response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  } catch {
    /* headers already sent (streamed) — the policy simply does not apply */
  }
  return response;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // The GHSA vector: a navigation to a server function must never be rendered.
      // Refused before the handler so no attacker-controlled field is ever parsed
      // for a browser response.
      if (isServerFnNavigation(request)) {
        return withSecurityHeaders(serverFnRefusalResponse(), nonceForRequest(request));
      }

      // Same request object -> `nonceForRequest` hands back the same value the
      // router resolved inside `getRouter()`, so header and scripts agree.
      const nonce = nonceForRequest(request);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const finalResponse = await normalizeCatastrophicSsrResponse(response);
      // Second line of defence: even if the guard above missed a shape, an HTML
      // document on a server-function path is the GHSA payload by definition.
      if (
        isServerFnPath(request) &&
        request.headers.get("x-tsr-serverFn") !== "true" &&
        (finalResponse.headers.get("content-type") ?? "").includes("text/html")
      ) {
        return withSecurityHeaders(serverFnRefusalResponse(), nonce);
      }
      return withSecurityHeaders(finalResponse, nonce);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
