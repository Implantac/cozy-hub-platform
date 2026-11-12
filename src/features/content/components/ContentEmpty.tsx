import { FileText, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/app/EmptyState";

export function ContentEmptyAll() {
  const { t } = useTranslation();
  return (
    <EmptyState
      variant="card"
      icon={FileText}
      title={t("content.emptyTitle")}
      text={t("content.emptyText")}
      action={
        <button
          type="button"
          onClick={() => document.querySelector<HTMLInputElement>("#draft-title")?.focus()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus aria-hidden="true" className="size-4" /> {t("content.firstDraft")}
        </button>
      }
    />
  );
}

export function ContentEmptyFiltered({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      variant="dashed"
      icon={Search}
      title={t("content.filteredTitle")}
      text={t("content.filteredText")}
      action={
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80"
        >
          {t("content.clearFilters")}
        </button>
      }
    />
  );
}
