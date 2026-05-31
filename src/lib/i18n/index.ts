import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./locales/pt-BR.json";
import enUS from "./locales/en-US.json";

export const SUPPORTED_LANGUAGES = [
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "en-US", label: "English (US)" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const STORAGE_KEY = "digital-os:lang";

function detectInitialLang(): LanguageCode {
  if (typeof window === "undefined") return "pt-BR";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "pt-BR" || stored === "en-US") return stored;
  return "pt-BR";
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      "pt-BR": { translation: ptBR },
      "en-US": { translation: enUS },
    },
    lng: detectInitialLang(),
    fallbackLng: "pt-BR",
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export function setLanguage(lang: LanguageCode) {
  i18n.changeLanguage(lang);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }
}

export default i18n;
