import { FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FEATURES } from "@/lib/features/flags";

/** A presentation label only: it never bypasses authentication or simulates data. */
export function PortfolioNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  if (!FEATURES.portfolio) return null;
  return (
    <aside
      aria-label={t("portfolio.title")}
      className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
    >
      <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
      {compact ? (
        <p className="text-muted-foreground">{t("portfolio.short")}</p>
      ) : (
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{t("portfolio.title")}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {t("portfolio.description")}
          </p>
        </div>
      )}
    </aside>
  );
}
