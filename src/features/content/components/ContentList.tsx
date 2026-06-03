import { CheckSquare, Square } from "lucide-react";
import { ListSkeleton } from "@/components/app/Skeletons";
import type { Content } from "@/lib/api/_types";
import type { ContentStatus } from "../constants";
import { ContentRow } from "./ContentRow";
import { ContentEmptyAll, ContentEmptyFiltered } from "./ContentEmpty";

type Props = {
  items: Content[];
  filtered: Content[];
  isLoading: boolean;
  selected: Set<string>;
  allVisibleSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onStatusChange: (id: string, status: ContentStatus) => void;
  onClearFilters: () => void;
};

export function ContentList({
  items, filtered, isLoading, selected, allVisibleSelected,
  onToggleAll, onToggleOne, onStatusChange, onClearFilters,
}: Props) {
  return (
    <div className="space-y-2">
      {filtered.length > 0 && (
        <button
          onClick={onToggleAll}
          className="inline-flex items-center gap-2 px-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {allVisibleSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
          {allVisibleSelected ? "Unselect all" : "Select all"}
        </button>
      )}
      {filtered.map((c) => (
        <ContentRow
          key={c.id}
          item={c}
          selected={selected.has(c.id)}
          onToggle={() => onToggleOne(c.id)}
          onStatusChange={(status) => onStatusChange(c.id, status)}
        />
      ))}
      {isLoading && <ListSkeleton rows={4} />}
      {!isLoading && filtered.length === 0 && (
        items.length === 0
          ? <ContentEmptyAll />
          : <ContentEmptyFiltered onClear={onClearFilters} />
      )}
    </div>
  );
}
