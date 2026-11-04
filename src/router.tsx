import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * CSP nonce for the current render, or `undefined` when there is no request.
 *
 * `createServerOnlyFn` strips the server implementation from the client bundle,
 * but its browser stub deliberately throws if called. The router factory runs
 * both during SSR and browser hydration, so the call must be guarded. On the
 * server the Start runtime creates the router per request.
 *
 * It must stay **synchronous**: an `async` `getRouter()` blows past the memory the
 * Nitro bundling step can use and the production build dies with a heap OOM.
 */
import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { nonceForRequest } from "./lib/security/headers";

const requestNonce = createServerOnlyFn((): string | undefined => {
  const request = getRequest();
  return request ? nonceForRequest(request) : undefined;
});

export const getRouter = () => {
  const queryClient = new QueryClient();
  const nonce = typeof window === "undefined" ? requestNonce() : undefined;

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(nonce ? { ssr: { nonce } } : {}),
  });

  return router;
};
