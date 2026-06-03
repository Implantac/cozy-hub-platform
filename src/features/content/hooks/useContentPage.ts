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
import {
  useWorkspaceMutation,
  useWorkspaceQuery,
} from "@/lib/query/use-workspace-query";
import type { Content } from "@/lib/api/_types";
import { STATUSES, type ContentStatus, type FilterValue } from "../constants";

export function useContentPage() {
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

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const items = q.data ?? [];
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

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((c) => next.delete(c.id));
      else filtered.forEach((c) => next.add(c.id));
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
    () => create({ data: { workspaceId: q.wsId!, title, body, type: "post" } }),
    {
      invalidate: invalidateKey,
      successMessage: "Draft created",
      onSuccess: () => {
        setTitle("");
        setBody("");
      },
    },
  );

  const changeStatus = (id: string, status: ContentStatus) => {
    if (!q.wsId) return;
    updateStatus({ data: { id, status, workspaceId: q.wsId } })
      .then(() => qc.invalidateQueries({ queryKey: invalidateKey }))
      .catch((e: Error) => toast.error(e.message));
  };

  const runBulkStatus = (status: ContentStatus) => {
    if (!q.wsId || selected.size === 0) return;
    bulkStatus({ data: { workspaceId: q.wsId, ids: [...selected], status } })
      .then((r) => {
        toast.success(`${r.count} moved to ${status}`);
        setSelected(new Set());
        qc.invalidateQueries({ queryKey: invalidateKey });
      })
      .catch((e: Error) => toast.error(e.message));
  };

  const runBulkDelete = () => {
    if (!q.wsId || selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} item(s)? This cannot be undone.`)) return;
    bulkDelete({ data: { workspaceId: q.wsId, ids: [...selected] } })
      .then((r) => {
        toast.success(`${r.count} deleted`);
        setSelected(new Set());
        qc.invalidateQueries({ queryKey: invalidateKey });
      })
      .catch((e: Error) => toast.error(e.message));
  };

  const clearFilters = () => {
    setFilter("all");
    setSearch("");
  };

  return {
    q, items, filtered, counts,
    title, setTitle, body, setBody,
    filter, setFilter, search, setSearch,
    selected, setSelected, allVisibleSelected, toggleAll, toggleOne,
    createMut, changeStatus, runBulkStatus, runBulkDelete, clearFilters,
  };
}
