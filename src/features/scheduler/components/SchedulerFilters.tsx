import { Play } from "lucide-react";
import { STATUSES, STATUS_META } from "../constants";

type Filter = (typeof STATUSES)[number];

type Props = {
  filter: Filter;
  setFilter: (f: Filter) => void;
  counts: Record<string, number>;
  total: number;
  onTick: () => void;
  tickDisabled: boolean;
  tickPending: boolean;
};

export function SchedulerFilters({ filter, setFilter, counts, total, onTick, tickDisabled, tickPending }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => {
          const active = s === filter;
          const label = s === "all" ? "All" : STATUS_META[s].label;
          const count = s === "all" ? total : counts[s] ?? 0;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <span className="rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={onTick}
        disabled={tickDisabled}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        <Play className="size-3.5" />
        {tickPending ? "Dispatching..." : "Run dispatcher"}
      </button>
    </div>
  );
}
