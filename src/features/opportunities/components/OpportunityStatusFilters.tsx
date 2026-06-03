import { STATUS, type OpportunityStatusFilter } from "../constants";

type Props = {
  value: OpportunityStatusFilter;
  onChange: (v: OpportunityStatusFilter) => void;
};

export function OpportunityStatusFilters({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUS.map((s) => (
        <button
          key={s.label}
          onClick={() => onChange(s.id)}
          className={`rounded-full border px-4 py-1.5 text-sm transition hover-lift ${
            value === s.id
              ? "border-primary bg-primary text-primary-foreground shadow-glow"
              : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
