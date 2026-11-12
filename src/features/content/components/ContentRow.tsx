import { MANUAL_CONTENT_STATUSES, type ManualContentStatus } from "@/lib/content/status";
import { useTranslation } from "react-i18next";
import { CheckSquare, Square } from "lucide-react";
import type { Content } from "@/lib/api/_types";
import { STATUS_STYLES, type ContentStatus } from "../constants";

interface ContentRowProps {
  item: Content;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onStatusChange: (status: ManualContentStatus) => void;
}

export function ContentRow({
  item: c,
  selected,
  disabled = false,
  onToggle,
  onEdit,
  onStatusChange,
}: ContentRowProps) {
  const { t } = useTranslation();
  return (
    <div
      className={`section-card hover-lift flex flex-wrap items-center gap-3 p-4 transition ${
        selected ? "border-primary ring-1 ring-primary/30" : ""
      }`}
    >
      <button
        disabled={disabled || c.status === "scheduled" || c.status === "publishing"}
        onClick={onToggle}
        className="text-muted-foreground hover:text-foreground"
        aria-label={t(selected ? "content.unselect" : "content.select", {
          title: c.title || t("content.untitled"),
        })}
        aria-pressed={selected}
      >
        {selected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{c.title || t("content.untitled")}</div>
        <div className="text-xs text-muted-foreground">
          {c.brand?.name ?? t("content.noBrand")} ·{" "}
          {t(`content.${c.type}`, { defaultValue: c.type })}
        </div>
      </div>
      <span
        className={`hidden rounded-full px-2 py-0.5 text-[10px] font-medium capitalize sm:inline-block ${
          STATUS_STYLES[c.status as ContentStatus] ?? "bg-secondary"
        }`}
      >
        {t(`content.${c.status}`, { defaultValue: c.status })}
      </span>
      <button
        type="button"
        disabled={disabled || c.status === "scheduled" || c.status === "publishing"}
        onClick={onEdit}
        aria-label={t("content.editItem", { title: c.title || t("content.untitled") })}
        className="min-h-11 rounded-md border border-input px-3 py-2 text-xs disabled:opacity-50"
      >
        {t("content.edit")}
      </button>
      <select
        disabled={disabled || c.status === "scheduled" || c.status === "publishing"}
        aria-label={t("content.status", { title: c.title || t("content.untitled") })}
        value={c.status}
        onChange={(e) => onStatusChange(e.target.value as ManualContentStatus)}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs capitalize"
      >
        {c.status !== "draft" && c.status !== "archived" && (
          <option value={c.status} disabled>
            {t(`content.${c.status}`, { defaultValue: c.status })}
          </option>
        )}
        {MANUAL_CONTENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(`content.${s}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
