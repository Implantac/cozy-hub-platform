import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./locales/pt-BR.json";
import enUS from "./locales/en-US.json";

/**
 * VELT — Internationalization layer
 *
 * Two languages ship, and only two are offered: pt-BR (the product's authoring
 * language) and en-US.
 *
 * Why the list shrank from 16 to 2
 * --------------------------------
 * The previous configuration advertised sixteen languages in the selector while
 * only two had translations. Picking 日本語 or العربية switched the whole UI to
 * English — the fallback — silently. To the user the product looked broken, or
 * worse, looked like it had ignored their choice. A language that is listed and
 * does not work is not "coming soon"; it is a bug on the first screen a
 * non-Brazilian user touches, and it was shipped to everyone.
 *
 * Adding a language is still cheap, and the support is intact:
 *   1. Put `locales/<code>.json` next to the other two.
 *   2. Add it to `SUPPORTED_LANGUAGES` below with a `resources` import.
 * Nothing else in the app needs to change — the switcher, the detector and the
 * direction handling all read from that array.
 *
 * The `RTL_LOCALES` set stays so that the first RTL language is a one-line
 * addition rather than a refactor of `applyDirection`.
 */

/** Locales written right to left. Empty today; `applyDirection` already honours it. */
const RTL_LOCALES = new Set<string>(["ar", "he", "fa", "ur"]);

export type LanguageCode = "pt-BR" | "en-US";

export type LanguageMeta = {
  code: LanguageCode;
  label: string;
  native: string;
  flag: string;
};

export const SUPPORTED_LANGUAGES: ReadonlyArray<LanguageMeta> = [
  { code: "pt-BR", label: "Portuguese (Brazil)", native: "Português (Brasil)", flag: "🇧🇷" },
  { code: "en-US", label: "English (US)", native: "English (US)", flag: "🇺🇸" },
] as const;

const STORAGE_KEY = "use-os:lang";
const VALID_CODES = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));
const DEFAULT_LANGUAGE: LanguageCode = "pt-BR";

/**
 * Picks the starting language.
 *
 * Exported for tests: it is a pure decision over storage and the browser, and it
 * is the part that has to be right. Testing it through i18next instead would test
 * the singleton's initialisation order, which is not what we care about.
 *
 * A previously stored choice wins, but only if it is still offered — a user who
 * had selected `de` before the list shrank must land on a real translation, not
 * on a dead code. Then the browser preference is honoured by base language, so
 * `pt-PT` and `en-GB` still resolve sensibly.
 */
export function detectInitialLang(): LanguageCode {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && VALID_CODES.has(stored)) return stored as LanguageCode;

  const nav = window.navigator?.language;
  if (!nav) return DEFAULT_LANGUAGE;

  if (VALID_CODES.has(nav)) return nav as LanguageCode;

  const base = nav.split("-")[0];
  if (base === "pt") return "pt-BR";
  if (base === "en") return "en-US";

  return DEFAULT_LANGUAGE;
}

function applyDirection(lang: string) {
  if (typeof document === "undefined") return;
  const base = lang.split("-")[0];
  document.documentElement.dir = RTL_LOCALES.has(base) ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

if (!i18n.isInitialized) {
  const initial = detectInitialLang();

  i18n.use(initReactI18next).init({
    resources: {
      "pt-BR": { translation: ptBR },
      "en-US": { translation: enUS },
    },
    lng: initial,
    fallbackLng: "en-US",
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  applyDirection(initial);
}

export function setLanguage(lang: LanguageCode) {
  i18n.changeLanguage(lang);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, lang);
    applyDirection(lang);
  }
}

export function isRtl(lang: string): boolean {
  return RTL_LOCALES.has(lang.split("-")[0]);
}

export default i18n;
