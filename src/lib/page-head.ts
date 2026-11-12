import { requestLang, translateServer } from "@/lib/i18n/translate";

/** Shared metadata for VELT content routes. Images belong to individual pages. */
export function pageHead(name: string, description: string) {
  const title = `${name} · VELT`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}

/** Private modules keep public pages SSR-enabled while identifying the current tab. */
export async function modulePageHead(navKey: string) {
  const language = await requestLang();
  const name = translateServer(language, "nav", navKey, "VELT");
  return {
    meta: [
      ...pageHead(name, `${name} · workspace VELT`).meta,
      { name: "robots", content: "noindex, nofollow" },
    ],
  };
}
