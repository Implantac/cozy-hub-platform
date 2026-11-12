import { MANUAL_CONTENT_STATUSES, type ManualContentStatus } from "@/lib/content/status";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";

interface BulkActionBarProps {
  count: number;
  onMoveTo: (status: ManualContentStatus) => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionBar({ count, onMoveTo, onDelete, onClear }: BulkActionBarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <span className="font-medium">{t("content.selected", { count })}</span>
      <span className="text-muted-foreground">·</span>
      {MANUAL_CONTENT_STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => onMoveTo(s)}
          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs capitalize hover:bg-secondary"
        >
          {t("content.moveTo", { status: t(`content.${s}`) })}
        </button>
      ))}
      <button
        onClick={onDelete}
        className="ml-auto inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/25"
      >
        <Trash2 aria-hidden="true" className="size-3" /> {t("content.delete")}
      </button>
      <button
        onClick={onClear}
        className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {t("content.clear")}
      </button>
    </div>
  );
}
