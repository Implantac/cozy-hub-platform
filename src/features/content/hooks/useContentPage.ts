import { parseMediaInput } from "@/lib/content/media";
import { type ManualContentStatus } from "@/lib/content/status";
import { useWorkspaceAccess } from "@/lib/workspace/use-workspace-access";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  bulkDeleteContent,
  bulkUpdateContentStatus,
  createContent,
  listContent,
  updateContentStatus,
} from "@/lib/api/content.functions";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import type { Content } from "@/lib/api/_types";
import { STATUSES, type FilterValue } from "../constants";

export function useContentPage() {
  const { t } = useTranslation();
  const access = useWorkspaceAccess();
  const qc = useQueryClient();
  const list = useServerFn(listContent);
  const create = useServerFn(createContent);
  const updateStatus = useServerFn(updateContentStatus);
  const bulkStatus = useServerFn(bulkUpdateContentStatus);
  const bulkDelete = useServerFn(bulkDeleteContent);

  const q = useWorkspaceQuery<Content[]>(
    (wsId) => ["content", wsId],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const invalidateKey = q.wsId ? ["content", q.wsId] : ["content"];
  const relatedKeys = [
    invalidateKey,
    ...["scheduler-options", "scheduler", "analytics"].map((key) =>
      q.wsId ? [key, q.wsId] : [key],
    ),
  ];
  const invalidateViews = () =>
    Promise.all(relatedKeys.map((queryKey) => qc.invalidateQueries({ queryKey })));

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaInput, setMediaInput] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);

  // Memoized so downstream useMemo deps stay referentially stable across renders.
  const items = useMemo(() => q.data ?? [], [q.data]);
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (!s) return true;
      return (
        (c.title ?? "").toLowerCase().includes(s) ||
        (c.body ?? "").toLowerCase().includes(s) ||
        (c.brand?.name ?? "").toLowerCase().includes(s)
      );
    });
  }, [items, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const s of STATUSES) c[s] = 0;
    for (const it of items) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [items]);

  const selectable = filtered.filter((c) => c.status !== "scheduled" && c.status !== "publishing");
  const allVisibleSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.id));

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) selectable.forEach((c) => next.delete(c.id));
      else selectable.forEach((c) => next.add(c.id));
      return next;
    });

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const createMut = useWorkspaceMutation(
    () =>
      create({
        data: {
          workspaceId: q.wsId!,
          title: title.trim(),
          body,
          type: "post",
          mediaUrls: parseMediaInput(mediaInput),
        },
      }),
    {
      invalidate: relatedKeys,
      successMessage: t("content.created"),
      onSuccess: () => {
        setTitle("");
        setBody("");
        setMediaInput("");
      },
    },
  );

  const changeStatus = (id: string, status: ManualContentStatus) => {
    if (!q.wsId || !access.canEdit) return;
    updateStatus({ data: { id, status, workspaceId: q.wsId } })
      .then(() => invalidateViews())
      .catch((e: Error) => toast.error(e.message));
  };

  const runBulkStatus = (status: ManualContentStatus) => {
    if (!q.wsId || !access.canEdit || bulkPending || selected.size === 0) return;
    setBulkPending(true);
    bulkStatus({ data: { workspaceId: q.wsId, ids: [...selected], status } })
      .then((r) => {
        if (r.missingCount)
          toast.warning(t("content.partial", { count: r.count, missing: r.missingCount }));
        else toast.success(t("content.moved", { count: r.count, status: t(`content.${status}`) }));
        setSelected(new Set());
        invalidateViews();
      })
      .catch((e: Error) => {
        toast.error(e.message);
        void invalidateViews();
      })
      .finally(() => setBulkPending(false));
  };

  const runBulkDelete = () => {
    if (!q.wsId || !access.canEdit || bulkPending || selected.size === 0) return;
    if (!confirm(t("content.confirmDelete", { count: selected.size }))) return;
    setBulkPending(true);
    bulkDelete({ data: { workspaceId: q.wsId, ids: [...selected] } })
      .then((r) => {
        if (r.missingCount)
          toast.warning(t("content.partial", { count: r.count, missing: r.missingCount }));
        else toast.success(t("content.deleted", { count: r.count }));
        setSelected(new Set());
        invalidateViews();
      })
      .catch((e: Error) => {
        toast.error(e.message);
        void invalidateViews();
      })
      .finally(() => setBulkPending(false));
  };

  const clearFilters = () => {
    setFilter("all");
    setSearch("");
  };

  return {
    access,
    bulkPending,
    q,
    items,
    filtered,
    counts,
    title,
    setTitle,
    body,
    setBody,
    mediaInput,
    setMediaInput,
    filter,
    setFilter,
    search,
    setSearch,
    selected,
    setSelected,
    allVisibleSelected,
    toggleAll,
    toggleOne,
    createMut,
    changeStatus,
    runBulkStatus,
    runBulkDelete,
    clearFilters,
  };
}
