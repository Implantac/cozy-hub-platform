import i18n, { createInstance } from "i18next";
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
const COOKIE_KEY = "velt_lang";
const VALID_CODES = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));
const DEFAULT_LANGUAGE: LanguageCode = "pt-BR";
const resources = {
  "pt-BR": { translation: ptBR },
  "en-US": { translation: enUS },
};

function supportedLanguage(value?: string | null): LanguageCode | undefined {
  if (!value) return undefined;
  if (VALID_CODES.has(value)) return value as LanguageCode;
  const base = value.split("-")[0].toLowerCase();
  if (base === "pt") return "pt-BR";
  if (base === "en") return "en-US";
  return undefined;
}

function cookieValue(cookieHeader: string | null | undefined, name: string): string | undefined {
  const part = cookieHeader
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  if (!part) return undefined;
  try {
    return decodeURIComponent(part.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

export function languagePreferenceFromCookie(cookieHeader?: string | null): string | undefined {
  return cookieValue(cookieHeader, COOKIE_KEY);
}

function browserCookieValue(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return cookieValue(document.cookie, name);
}

/**
 * Creates a request-scoped instance for SSR and hydration. This avoids changing
 * the process-wide i18next singleton while concurrent requests use different
 * languages.
 */
export function createI18nInstance(language: LanguageCode) {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: "en-US",
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
  });
  return instance;
}

/** Picks saved choice first, then browser preference; unsupported choices are ignored. */
export function detectInitialLang(): LanguageCode {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;

  try {
    const stored = supportedLanguage(window.localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // Storage may be blocked by a strict browser privacy setting.
  }

  const cookie = supportedLanguage(browserCookieValue(COOKIE_KEY));
  if (cookie) return cookie;
  return supportedLanguage(window.navigator?.language) ?? DEFAULT_LANGUAGE;
}

/** Resolves a server request by saved cookie, then Accept-Language. */
export function resolveLang(
  acceptLanguage?: string | null,
  preferredLanguage?: string | null,
): LanguageCode {
  if (typeof window !== "undefined") return detectInitialLang();

  const preferred = supportedLanguage(preferredLanguage);
  if (preferred) return preferred;
  if (!acceptLanguage) return DEFAULT_LANGUAGE;

  // "pt-BR,pt;q=0.9,en;q=0.8" -> ["pt-BR", "pt", "en"]
  const tags = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0].trim())
    .filter(Boolean);

  for (const tag of tags) {
    const language = supportedLanguage(tag);
    if (language) return language;
  }
  return DEFAULT_LANGUAGE;
}

function applyDirection(lang: string) {
  if (typeof document === "undefined") return;
  const base = lang.split("-")[0];
  document.documentElement.dir = RTL_LOCALES.has(base) ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: "en-US",
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

/** Saves a non-sensitive preference to localStorage and an SSR-readable cookie. */
export function persistLanguagePreference(lang: LanguageCode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // The cookie still lets SSR and the next visit retain the selection.
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(lang)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  applyDirection(lang);
}

export function isRtl(lang: string): boolean {
  return RTL_LOCALES.has(lang.split("-")[0]);
}

export default i18n;
