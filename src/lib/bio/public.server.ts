/**
 * VELT — Public bio page reader (server-only, unauthenticated).
 *
 * This is the only module allowed to read bio data without a session. It uses
 * the service-role client on purpose: `anon` has no SELECT grant on the bio
 * tables, so the *only* way to expose a page is through this function, which
 * enforces the two conditions that make a page public:
 *
 *     is_published = true  AND  slug = <requested>
 *
 * Keeping the rule in one place means a future contributor cannot accidentally
 * publish a draft by adding a policy.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { deviceFromUserAgent, referrerHostOnly } from "./validate";

/**
 * The service-role client is generated and always constructs a Realtime client,
 * which throws on runtimes without a native WebSocket (Node < 22) even though
 * this route never uses Realtime. Every other server module works around it
 * individually. Here the workaround is a module-level guard: if the generated
 * client throws on first touch, the route answers "unavailable" instead of
 * crashing, and the guard keeps the failed construction from repeating on every
 * request inside the same process.
 */
let adminClientBroken = false;

import type { PublicBioLink, PublicBioPage } from "./types";

export type { PublicBioLink, PublicBioPage };

/**
 * Outcome of a public load.
 *
 * `not_found` and `unavailable` are kept apart for a reason that only shows up
 * in production: if the database is misconfigured, the honest answer is 503, not
 * 404. Collapsing both into `null` made a broken deployment look like every page
 * had been deleted, and the thrown error message ("Missing Supabase environment
 * variable(s): SUPABASE_SERVICE_ROLE_KEY") was rendered into the HTML — infra
 * detail on a page strangers can read.
 *
 * The *reason* is logged server-side and never sent to the browser.
 */
export type BioLoadResult =
  { status: "ok"; page: PublicBioPage } | { status: "not_found" } | { status: "unavailable" };

/**
 * Loads a published page. Returns null for missing, unpublished, or malformed
 * slugs — deliberately indistinguishable, so the endpoint does not leak which
 * slugs exist.
 */
export async function getPublicBioPage(slugRaw: string): Promise<PublicBioPage | null> {
  const result = await loadBioPage(slugRaw);
  return result.status === "ok" ? result.page : null;
}

/** Same read as `getPublicBioPage`, but tells "no such page" from "system down". */
export async function loadBioPage(slugRaw: string): Promise<BioLoadResult> {
  const slug = slugRaw.trim().toLowerCase();
  // Malformed slugs are a 404 without a query: never let user input reach the DB
  // shape-checked only by the regex above.
  if (!/^[a-z0-9-]{3,32}$/.test(slug)) return { status: "not_found" };

  if (adminClientBroken) return { status: "unavailable" };

  try {
    const result = await readPublicPage(slug);
    if (result.error) {
      console.error("[bio] public read failed:", result.error.message);
      return { status: "unavailable" };
    }
    return result.page ? { status: "ok", page: result.page } : { status: "not_found" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Thrown by the service-role client constructor when env vars are missing or
    // the runtime lacks a WebSocket. Log the detail, return a neutral state, and
    // stop retrying a client that cannot be constructed.
    if (/environment variable|WebSocket/i.test(message)) adminClientBroken = true;
    console.error("[bio] public read threw:", message);
    return { status: "unavailable" };
  }
}

async function readPublicPage(
  slug: string,
): Promise<{ page: PublicBioPage | null; error: { message: string } | null }> {
  const { data: page, error } = await supabaseAdmin
    .from("bio_pages")
    .select(
      "id, workspace_id, slug, headline, bio, avatar_url, theme, is_published, seo_title, seo_description",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error || !page) return { page: null, error: error ? { message: error.message } : null };

  const [{ data: links }, { data: workspace }] = await Promise.all([
    supabaseAdmin
      .from("bio_links")
      .select("id, label, url, kind, icon")
      .eq("page_id", page.id)
      .eq("is_active", true)
      .order("position", { ascending: true }),
    supabaseAdmin.from("workspaces").select("name").eq("id", page.workspace_id).maybeSingle(),
  ]);

  return {
    error: null,
    page: {
      slug: page.slug,
      headline: page.headline,
      bio: page.bio,
      avatarUrl: page.avatar_url,
      theme: page.theme,
      seoTitle: page.seo_title,
      seoDescription: page.seo_description,
      workspaceName: workspace?.name ?? "VELT",
      links: (links ?? []).map((l) => ({
        id: l.id,
        label: l.label,
        url: l.url,
        kind: l.kind,
        icon: l.icon,
      })),
    },
  };
}

/** Counts a page view. Best-effort: never blocks or fails the render. */
export async function registerPageView(slug: string): Promise<void> {
  try {
    await supabaseAdmin.rpc("bio_register_view", { _slug: slug });
  } catch {
    /* counters are not worth a failed request */
  }
}

/**
 * Resolves a click target and records the click.
 *
 * The URL is re-read from the database by id rather than taken from the request:
 * accepting a client-supplied target here would turn our domain into an open
 * redirect. If the link is inactive or missing, nothing is returned.
 */
export async function resolveAndTrackClick(
  linkId: string,
  meta: { referrer?: string | null; userAgent?: string | null },
): Promise<string | null> {
  const { data: link } = await supabaseAdmin
    .from("bio_links")
    .select("url, is_active")
    .eq("id", linkId)
    .maybeSingle();

  if (!link || !link.is_active) return null;
  // Defence in depth: even if a bad URL reached the DB before validation was
  // added, never redirect to a non-http protocol.
  if (!/^https?:\/\//i.test(link.url)) return null;

  try {
    // The generated types declare these args as `string | undefined`, not
    // `string | null`: PostgREST omits absent fields, and an explicit `null`
    // would be sent as JSON null. Both land on the SQL default, so the honest
    // spelling is `undefined` — and it avoids a cast.
    const referrerHost = referrerHostOnly(meta.referrer);
    const device = deviceFromUserAgent(meta.userAgent);

    await supabaseAdmin.rpc("bio_register_click", {
      _link_id: linkId,
      ...(referrerHost ? { _referrer_host: referrerHost } : {}),
      ...(device ? { _device: device } : {}),
      // `_country` stays unset until the edge layer supplies it.
    });
  } catch {
    /* tracking must never break the redirect */
  }

  return link.url;
}

/** Re-exported so server callers keep one import site; the data itself lives in
 *  the isomorphic `theme.ts` (see the note there about bundle leakage). */
export { THEMES, THEME_IDS, themeFor, type BioTheme } from "./theme";
