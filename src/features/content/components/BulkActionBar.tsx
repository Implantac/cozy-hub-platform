import { Trash2 } from "lucide-react";
import { STATUSES, type ContentStatus } from "../constants";

interface BulkActionBarProps {
  count: number;
  onMoveTo: (status: ContentStatus) => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionBar({ count, onMoveTo, onDelete, onClear }: BulkActionBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <span className="font-medium">{count} selected</span>
      <span className="text-muted-foreground">·</span>
      {STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => onMoveTo(s)}
          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs capitalize hover:bg-secondary"
        >
          Move to {s}
        </button>
      ))}
      <button
        onClick={onDelete}
        className="ml-auto inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/25"
      >
        <Trash2 className="size-3" /> Delete
      </button>
      <button
        onClick={onClear}
        className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        Clear
      </button>
    </div>
  );
}
