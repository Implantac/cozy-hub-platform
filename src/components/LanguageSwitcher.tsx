import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { SUPPORTED_LANGUAGES, persistLanguagePreference, type LanguageCode } from "@/lib/i18n";

/**
 * VELT — Language switcher.
 * Renders all supported languages with their native names + flag.
 * The wrapper styling mirrors a sidebar nav item so it fits the AppShell.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? i18n.language) as LanguageCode;

  return (
    <label
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      title={t("common.language")}
    >
      <Languages className="size-4" />
      {!compact && <span className="sr-only">{t("common.language")}</span>}
      <select
        value={current}
        onChange={(e) => {
          const language = e.target.value as LanguageCode;
          void i18n.changeLanguage(language);
          persistLanguagePreference(language);
        }}
        className="flex-1 cursor-pointer bg-transparent text-sm outline-none"
        aria-label={t("common.language")}
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-background text-foreground">
            {l.flag} {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}
