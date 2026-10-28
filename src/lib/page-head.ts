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