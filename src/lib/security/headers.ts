/**
 * Response/request hardening applied at the single SSR entry point.
 *
 * Two independent problems live here:
 *
 * 1. **CSP with a per-request nonce.** The router emits inline `<script>` tags
 *    for hydration and streams; a strict `script-src 'self'` alone would break
 *    the app, and `'unsafe-inline'` would defeat the purpose. The router reads
 *    the nonce from `router.options.ssr.nonce` (see `createHydrationScripts`),
 *    so the nonce has to reach the router *before* it renders — which is why
 *    this module also owns the router hook below.
 *
 * 2. **Reflected XSS through server functions** (GHSA-qx66-fv34-fjm8, CVSS 9.3).
 *    TanStack's server-function transport passes payload fields into middleware
 *    state; a malformed payload leaves attacker-controlled content on the error
 *    path, and the handler treats a response-shaped object as an HTTP response.
 *    If a victim is lured to such a URL, the app returns *attacker HTML on its
 *    own origin*, running with the victim's authority. The transport is designed
 *    for `fetch` calls carrying `x-tsr-serverFn: true`; a top-level navigation
 *    never sends that header, so it can be refused before reaching the handler.
 */

/** Length of the hex nonce, in bytes of randomness. 16 bytes = 128 bits. */
const NONCE_BYTES = 16;

function randomNonce(): string {
  const bytes = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Path prefix the start plugin mounts server functions on.
 *
 * Mirrors `createServerFnBasePath` in `@tanstack/start-plugin-core`
 * (`"/" + routerBasepath + serverFnBase + "/"`); this app uses both defaults.
 */
const SERVER_FN_PREFIX = "/_serverFn/";

type RouterLike = {
  options: { ssr?: { nonce?: string }; [key: string]: unknown };
};

/**
 * Wraps the router factory so every request-scoped router carries its nonce.
 *
 * The start runtime calls `getRouter()` per request; assigning `options.ssr`
 * here is the supported seam (a static object in `router.tsx` would always be
 * `undefined` on the server, because the nonce is generated per request).
 */
export function withNonce<T extends RouterLike>(router: T, nonce: string): T {
  router.options.ssr = { ...(router.options.ssr ?? {}), nonce };
  return router;
}

/**
 * Decides whether a request is an attempt to render a server function in a
 * browser tab, which is the shape of the GHSA vector.
 *
 * Legitimate calls: `fetch` from the client with `x-tsr-serverFn: true`.
 * Attack: a link/navigation, which is identifiable by the absence of that
 * header combined with navigation-shaped headers.
 */
export function isServerFnNavigation(request: Request): boolean {
  if (!isServerFnPath(request)) return false;

  // The transport's own marker. Legitimate calls set it; a top-level navigation
  // cannot, because that is a plain document request made by the browser.
  if (request.headers.get("x-tsr-serverFn") === "true") return false;

  // Any browser-shaped marker counts. A navigation sets `sec-fetch-mode:
  // navigate` and `sec-fetch-dest: document`; `Accept: text/html` is what the
  // browser advertises when a URL is opened in a tab. curl and monitoring probes
  // send none of these, which is what keeps a health check from being 404'd.
  const mode = request.headers.get("sec-fetch-mode");
  const dest = request.headers.get("sec-fetch-dest");
  const accept = request.headers.get("accept") ?? "";

  return mode === "navigate" || dest === "document" || accept.includes("text/html");
}

/** True for any request aimed at the server-function transport. */
export function isServerFnPath(request: Request): boolean {
  try {
    return new URL(request.url).pathname.startsWith(SERVER_FN_PREFIX);
  } catch {
    return false;
  }
}

/** Body returned for a refused server-function navigation. */
export function serverFnRefusalResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

/**
 * Content-Security-Policy for this app.
 *
 * `connect-src` carries both the app origin and Supabase: every authenticated
 * screen talks to `https://<project>.supabase.co` directly from the browser.
 * `img-src` allows `https:` because post media and avatars are user-provided
 * URLs from arbitrary hosts. `frame-ancestors 'none'` is the clickjacking floor.
 */
export function buildCsp(nonce: string, reportOnly: boolean): string {
  const supabase = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const connect = ["'self'", supabase, supabase.replace("https://", "wss://")]
    .filter((v) => v.length > 0)
    .join(" ");

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    // Tailwind and the app ship inline styles; there is no inline-style sink that
    // matters for escaping HTML, so this stays permissive instead of fighting it.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ];

  if (reportOnly) directives.push("report-uri /api/csp-report");
  return directives.join("; ");
}

/** Header name that depends on the mode; report-only never blocks. */
export function cspHeaderName(reportOnly: boolean): string {
  return reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
}

/**
 * Per-request nonce, memoized on the request object itself.
 *
 * `server.ts` generates it and needs it for the header; the router needs the
 * *same* value for its inline scripts. Threading it through `requestOpts.context`
 * works in a production build but arrives empty under the dev server, so the
 * request object — shared by every layer of one request — carries it instead.
 * A `WeakMap` keeps it off the request's observable shape.
 */
const nonces = new WeakMap<Request, string>();

export function nonceForRequest(request: Request): string {
  const existing = nonces.get(request);
  if (existing) return existing;
  const nonce = randomNonce();
  nonces.set(request, nonce);
  return nonce;
}

/** Reads the nonce seeded by `server.ts` into the request middleware context. */
export function nonceFromContext(context: unknown): string | null {
  if (!context || typeof context !== "object") return null;
  const nonce = (context as { nonce?: unknown }).nonce;
  return typeof nonce === "string" && nonce.length > 0 ? nonce : null;
}

export { randomNonce, SERVER_FN_PREFIX };
