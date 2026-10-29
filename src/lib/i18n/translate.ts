import { createIsomorphicFn } from "@tanstack/react-start";

import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";
import { resolveLang, type LanguageCode } from "./index";

/**
 * Translation lookup for the `head` of routes, which runs on the server.
 *
 * `useTranslation` is a hook and route `head()` is not a component: it receives
 * `match`, executes during SSR, and its result must be a plain object. So the
 * server path reads the JSON dictionaries directly instead of going through the
 * i18next singleton.
 *
 * Same fallback rule as the client (`fallbackLng: "en-US"`): a key that only
 * exists in one dictionary resolves in both, and a key that exists in neither
 * falls back to the explicit `defaultValue` a caller can pass. A reported `—`
 * in the tab is worse than an English sentence.
 */

const DICTIONARIES: Record<LanguageCode, unknown> = {
  "pt-BR": ptBR,
  "en-US": enUS,
};

/** Keys this module will look up. Keeping the list closed catches typos at compile time. */
type Sections = "seo" | "root" | "routes";

export function translateServer(
  lang: LanguageCode,
  section: Sections,
  key: string,
  defaultValue: string,
): string {
  for (const code of [lang, "en-US"] as LanguageCode[]) {
    const tree = DICTIONARIES[code];
    const value = (tree as Record<string, Record<string, unknown>> | undefined)?.[section]?.[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return defaultValue;
}

/**
 * Language of the request being server-rendered.
 *
 * The route `head(ctx)` argument in this router version is a `RouteMatch`, which
 * carries the path and search but **not** the incoming `Request` — so
 * `Accept-Language` has to come from the start server, the same way
 * `auth-middleware.ts` reads the request. Outside a request (client navigation,
 * tests) there is no header and the client-side detection decides.
 */
const acceptLanguageHeader = createIsomorphicFn()
  .client(() => null)
  // Dynamic import, not a static one: `@tanstack/react-start/server` is
  // server-only and this module reaches the *browser* bundle through the route
  // files' `head()`. A top-level import fails the build with an import-protection
  // error — the dev server never shows it, because it does not enforce it.
  .server(async () => {
    const { getRequest } = await import("@tanstack/react-start/server");
    return getRequest()?.headers?.get("accept-language") ?? null;
  });

export async function requestLang(): Promise<LanguageCode> {
  return resolveLang(await acceptLanguageHeader());
}

/** Open Graph wants `pt_BR`, not `pt-BR`. */
export function ogLocale(lang: LanguageCode): string {
  return lang.replace("-", "_");
}
