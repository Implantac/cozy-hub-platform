import { Search } from "lucide-react";
import { FILTERS, type FilterValue } from "../constants";

interface ContentFiltersProps {
  filter: FilterValue;
  onFilterChange: (f: FilterValue) => void;
  search: string;
  onSearchChange: (s: string) => void;
  counts: Record<string, number>;
}

export function ContentFilters({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  counts,
}: ContentFiltersProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition ${
              filter === f
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f} <span className="ml-1 opacity-60">{counts[f] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="relative w-full md:w-72">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search content..."
          className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm"
        />
      </div>
    </div>
  );
}
