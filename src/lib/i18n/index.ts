import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./locales/pt-BR.json";
import enUS from "./locales/en-US.json";

/**
 * USE OS — Internationalization layer
 *
 * Architecture:
 *  - pt-BR is the default and product-authoring language.
 *  - en-US is the fallback for every other locale until specific
 *    translation files are added under ./locales/<code>.json.
 *  - Adding a new locale requires only:
 *      1. Drop the JSON file in ./locales
 *      2. Register it in SUPPORTED_LANGUAGES below
 *      3. Add it to the dynamic resources map
 *  - RTL languages are flagged so the document direction can flip.
 */

export type LanguageCode =
  | "pt-BR" | "en-US" | "es" | "fr" | "de" | "it"
  | "ja" | "zh-CN" | "ko" | "ru" | "ar" | "hi"
  | "tr" | "nl" | "pl" | "sv";

export const SUPPORTED_LANGUAGES: ReadonlyArray<{
  code: LanguageCode;
  label: string;
  native: string;
  flag: string;
  rtl?: boolean;
}> = [
  { code: "pt-BR", label: "Portuguese (Brazil)", native: "Português (Brasil)", flag: "🇧🇷" },
  { code: "en-US", label: "English (US)",         native: "English (US)",       flag: "🇺🇸" },
  { code: "es",    label: "Spanish",              native: "Español",             flag: "🇪🇸" },
  { code: "fr",    label: "French",               native: "Français",            flag: "🇫🇷" },
  { code: "de",    label: "German",               native: "Deutsch",             flag: "🇩🇪" },
  { code: "it",    label: "Italian",              native: "Italiano",            flag: "🇮🇹" },
  { code: "ja",    label: "Japanese",             native: "日本語",                flag: "🇯🇵" },
  { code: "zh-CN", label: "Chinese (Simplified)", native: "中文简体",              flag: "🇨🇳" },
  { code: "ko",    label: "Korean",               native: "한국어",                flag: "🇰🇷" },
  { code: "ru",    label: "Russian",              native: "Русский",             flag: "🇷🇺" },
  { code: "ar",    label: "Arabic",               native: "العربية",             flag: "🇸🇦", rtl: true },
  { code: "hi",    label: "Hindi",                native: "हिन्दी",                  flag: "🇮🇳" },
  { code: "tr",    label: "Turkish",              native: "Türkçe",              flag: "🇹🇷" },
  { code: "nl",    label: "Dutch",                native: "Nederlands",          flag: "🇳🇱" },
  { code: "pl",    label: "Polish",               native: "Polski",              flag: "🇵🇱" },
  { code: "sv",    label: "Swedish",              native: "Svenska",             flag: "🇸🇪" },
] as const;

const STORAGE_KEY = "use-os:lang";
const VALID_CODES = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));

function detectInitialLang(): LanguageCode {
  if (typeof window === "undefined") return "pt-BR";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && VALID_CODES.has(stored)) return stored as LanguageCode;
  const nav = window.navigator?.language;
  if (nav && VALID_CODES.has(nav)) return nav as LanguageCode;
  if (nav?.startsWith("pt")) return "pt-BR";
  if (nav?.startsWith("en")) return "en-US";
  const base = nav?.split("-")[0];
  if (base && VALID_CODES.has(base)) return base as LanguageCode;
  return "pt-BR";
}

function applyDirection(lang: LanguageCode) {
  if (typeof document === "undefined") return;
  const meta = SUPPORTED_LANGUAGES.find((l) => l.code === lang);
  document.documentElement.dir = meta?.rtl ? "rtl" : "ltr";
  document.documentElement.lang = lang;
}

if (!i18n.isInitialized) {
  // Resources: pt-BR + en-US ship with full translations.
  // Every other supported language falls back to en-US until a JSON file
  // is provided. This is intentional — it lets the product run globally
  // today without shipping 14 partial translation files.
  const fallbackResources = Object.fromEntries(
    SUPPORTED_LANGUAGES
      .filter((l) => l.code !== "pt-BR" && l.code !== "en-US")
      .map((l) => [l.code, { translation: enUS }]),
  );

  i18n.use(initReactI18next).init({
    resources: {
      "pt-BR": { translation: ptBR },
      "en-US": { translation: enUS },
      ...fallbackResources,
    },
    lng: detectInitialLang(),
    fallbackLng: "en-US",
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  applyDirection(detectInitialLang());
}

export function setLanguage(lang: LanguageCode) {
  i18n.changeLanguage(lang);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, lang);
    applyDirection(lang);
  }
}

export function isRtl(lang: string): boolean {
  return !!SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.rtl;
}

export default i18n;
