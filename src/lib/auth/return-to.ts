function hasUnsafeCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return character === "\\" || code <= 32 || code === 127;
  });
}

/** Only same-origin application destinations may be used after authentication. */
export function safeAppReturnTo(value: unknown): string {
  if (typeof value !== "string" || hasUnsafeCharacter(value)) return "/app";
  if (!value.startsWith("/app")) return "/app";
  try {
    const base = "https://velt.invalid";
    const url = new URL(value, base);
    const decodedPath = decodeURIComponent(url.pathname);
    if (
      url.origin !== base ||
      !/^\/app(?:\/|$)/.test(url.pathname) ||
      hasUnsafeCharacter(decodedPath) ||
      /%2f|%5c/i.test(url.pathname)
    ) {
      return "/app";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/app";
  }
}

export function loginSearch(search: Record<string, unknown>): {
  redirect?: string;
  mode?: "reset";
} {
  return {
    ...(typeof search.redirect === "string" ? { redirect: safeAppReturnTo(search.redirect) } : {}),
    ...(search.mode === "reset" ? { mode: "reset" as const } : {}),
  };
}
