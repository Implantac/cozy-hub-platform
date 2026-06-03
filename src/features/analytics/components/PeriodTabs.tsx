import { DAYS_OPTIONS, type DaysOption } from "../constants";

type Props = {
  days: DaysOption;
  onChange: (d: DaysOption) => void;
};

export function PeriodTabs({ days, onChange }: Props) {
  return (
    <div className="flex items-center gap-2" role="tablist" aria-label="Período">
      {DAYS_OPTIONS.map((d) => (
        <button
          key={d}
          role="tab"
          aria-selected={days === d}
          onClick={() => onChange(d)}
          className={`press rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            days === d
              ? "border-primary/50 bg-primary/10 text-primary shadow-glow-sm"
              : "border-border/70 bg-card/40 text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          Últimos {d} dias
        </button>
      ))}
    </div>
  );
}
