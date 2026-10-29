import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/**
 * CSP nonce for the current render, or `undefined` when there is no request.
 *
 * `createServerOnlyFn` is the sanctioned seam: the bundler strips the throwing
 * stub from the client build, so `@tanstack/react-start/server` never reaches the
 * browser. The function passed to it is only ever invoked on the server, inside
 * `getRouter()`, which the start runtime calls per request.
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
  const nonce = requestNonce();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(nonce ? { ssr: { nonce } } : {}),
  });

  return router;
};
