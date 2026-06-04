import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function AppearanceTab() {
  const { t } = useTranslation();
  return (
    <div className="section-card p-6">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("settings.appearance.title", "Idioma da interface")}</h3>
      <div className="max-w-xs">
        <LanguageSwitcher />
      </div>
    </div>
  );
}
