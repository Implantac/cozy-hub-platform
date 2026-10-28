import { CheckSquare, Square } from "lucide-react";
import type { Content } from "@/lib/api/_types";
import { STATUS_STYLES, STATUSES, type ContentStatus } from "../constants";

interface ContentRowProps {
  item: Content;
  selected: boolean;
  onToggle: () => void;
  onStatusChange: (status: ContentStatus) => void;
}

export function ContentRow({ item: c, selected, onToggle, onStatusChange }: ContentRowProps) {
  return (
    <div
      className={`section-card hover-lift flex items-center gap-3 p-4 transition ${
        selected ? "border-primary ring-1 ring-primary/30" : ""
      }`}
    >
      <button
        onClick={onToggle}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Select"
      >
        {selected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{c.title || "Untitled"}</div>
        <div className="text-xs text-muted-foreground">
          {c.brand?.name ?? "no brand"} · {c.type}
        </div>
      </div>
      <span
        className={`hidden rounded-full px-2 py-0.5 text-[10px] font-medium capitalize sm:inline-block ${
          STATUS_STYLES[c.status as ContentStatus] ?? "bg-secondary"
        }`}
      >
        {c.status}
      </span>
      <select
        value={c.status}
        onChange={(e) => onStatusChange(e.target.value as ContentStatus)}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs capitalize"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
