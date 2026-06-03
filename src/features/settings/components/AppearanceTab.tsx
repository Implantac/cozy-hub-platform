import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function AppearanceTab() {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6">
      <h3 className="mb-3 text-sm font-semibold">{t("settings.appearance.title", "Idioma da interface")}</h3>
      <div className="max-w-xs">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
