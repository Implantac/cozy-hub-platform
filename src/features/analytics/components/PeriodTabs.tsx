import { useId } from "react";
import { useTranslation } from "react-i18next";
import { DAYS_OPTIONS, type DaysOption } from "../constants";

type Props = { days: DaysOption; onChange: (days: DaysOption) => void };

/** Native radios provide selection, arrow keys and focus semantics without a fake tablist. */
export function PeriodTabs({ days, onChange }: Props) {
  const { t } = useTranslation();
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">{t("analytics.period")}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {DAYS_OPTIONS.map((value) => (
          <label key={value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={value}
              checked={days === value}
              onChange={() => onChange(value)}
              className="peer sr-only"
            />
            <span
              className={`press inline-flex min-h-11 items-center rounded-lg border px-3 py-2 text-xs font-medium transition peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background ${days === value ? "border-primary/50 bg-primary/10 text-primary shadow-glow-sm" : "border-border/70 bg-card/40 text-muted-foreground hover:border-border hover:text-foreground"}`}
            >
              {t("analytics.lastDays", { days: value })}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
