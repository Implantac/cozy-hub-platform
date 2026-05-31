import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { SUPPORTED_LANGUAGES, setLanguage, type LanguageCode } from "@/lib/i18n";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n, t } = useTranslation();
  const current = (i18n.language as LanguageCode) || "pt-BR";

  return (
    <label className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground">
      <Languages className="size-4" />
      {!compact && <span className="sr-only">{t("common.language")}</span>}
      <select
        value={current}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        className="flex-1 bg-transparent text-sm outline-none cursor-pointer"
        aria-label={t("common.language")}
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-background text-foreground">
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
