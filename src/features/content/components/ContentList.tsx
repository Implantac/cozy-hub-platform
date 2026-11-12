import { useState } from "react";
import { ContentEditorDialog } from "./ContentEditorDialog";
import { type ManualContentStatus } from "@/lib/content/status";
import { useTranslation } from "react-i18next";
import { CheckSquare, Square } from "lucide-react";
import { ListSkeleton } from "@/components/app/Skeletons";
import type { Content } from "@/lib/api/_types";
import { ContentRow } from "./ContentRow";
import { ContentEmptyAll, ContentEmptyFiltered } from "./ContentEmpty";

type Props = {
  items: Content[];
  filtered: Content[];
  isLoading: boolean;
  disabled?: boolean;
  selected: Set<string>;
  allVisibleSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onStatusChange: (id: string, status: ManualContentStatus) => void;
  onClearFilters: () => void;
};

export function ContentList({
  items,
  filtered,
  isLoading,
  disabled = false,
  selected,
  allVisibleSelected,
  onToggleAll,
  onToggleOne,
  onStatusChange,
  onClearFilters,
}: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Content | null>(null);
  return (
    <div className="space-y-2">
      {editing && !disabled && (
        <ContentEditorDialog key={editing.id} item={editing} onClose={() => setEditing(null)} />
      )}
      {filtered.length > 0 && (
        <button
          disabled={disabled}
          onClick={onToggleAll}
          className="inline-flex items-center gap-2 px-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {allVisibleSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
          {t(allVisibleSelected ? "content.unselectAll" : "content.selectAll")}
        </button>
      )}
      {filtered.map((c) => (
        <ContentRow
          key={c.id}
          item={c}
          disabled={disabled}
          selected={selected.has(c.id)}
          onToggle={() => onToggleOne(c.id)}
          onEdit={() => setEditing(c)}
          onStatusChange={(status) => onStatusChange(c.id, status)}
        />
      ))}
      {isLoading && <ListSkeleton rows={4} />}
      {!isLoading &&
        filtered.length === 0 &&
        (items.length === 0 ? (
          <ContentEmptyAll />
        ) : (
          <ContentEmptyFiltered onClear={onClearFilters} />
        ))}
    </div>
  );
}
