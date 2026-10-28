/**
 * VELT — Bio page themes (isomorphic).
 *
 * Lives outside `public.server.ts` on purpose. The first version put `themeFor`
 * next to the service-role reads, and importing it from the client component
 * dragged `client.server.ts` into the browser bundle — the service-role client
 * constructor ended up in `dist/client`. The key value was never exposed (the env
 * var is empty client-side), but shipping that code to the browser is a mistake
 * waiting to become an incident. Pure data belongs in a pure module.
 *
 * Themes are an allowlist, never user CSS: the column is a `text` with a CHECK
 * constraint, and anything unrecognised falls back to `aurora`.
 */

export interface BioTheme {
  bg: string;
  card: string;
  text: string;
  accent: string;
}

export const THEMES: Record<string, BioTheme> = {
  aurora: {
    bg: "linear-gradient(160deg,#0b1020 0%,#131a35 45%,#1b1140 100%)",
    card: "rgba(255,255,255,0.06)",
    text: "#f4f6ff",
    accent: "#8b7cff",
  },
  minimal: {
    bg: "#f7f7f8",
    card: "#ffffff",
    text: "#14161c",
    accent: "#14161c",
  },
  sunset: {
    bg: "linear-gradient(170deg,#1a0b12 0%,#3a1420 55%,#5c1f1a 100%)",
    card: "rgba(255,255,255,0.08)",
    text: "#fff5ef",
    accent: "#ff8a5c",
  },
};

export const THEME_IDS = Object.keys(THEMES) as Array<keyof typeof THEMES>;

export function themeFor(name: string | null | undefined): BioTheme {
  return (name && THEMES[name]) || THEMES.aurora;
}
