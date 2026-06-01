import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { FileText, Plus, Search, Trash2, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PageTransition } from "@/components/app/Motion";
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

export const Route = createFileRoute("/_authenticated/app/content")({
  component: ContentPage,
});

type ContentStatus = "draft" | "scheduled" | "published" | "archived";
const STATUSES: readonly ContentStatus[] = ["draft", "scheduled", "published", "archived"] as const;
const FILTERS = ["all", ...STATUSES] as const;
type FilterValue = (typeof FILTERS)[number];

const STATUS_STYLES: Record<ContentStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  scheduled: "bg-primary/15 text-primary",
  published: "bg-success/15 text-success",
  archived: "bg-muted text-muted-foreground",
};

function ContentPage() {
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

  const allVisibleSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((c) => next.delete(c.id));
      else filtered.forEach((c) => next.add(c.id));
      return next;
    });
  };
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

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={FileText}
          title="Content"
          subtitle="Drafts, templates and AI-assisted creation."
        />

        {/* Composer */}
        <div className="rounded-2xl border border-border bg-card/60 p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (title.length >= 1) createMut.mutate();
            }}
            className="space-y-3"
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your post..."
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              disabled={createMut.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="size-4" /> New draft
            </button>
          </form>
        </div>

        {/* Filters + search */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search content..."
              className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm"
            />
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
            <span className="font-medium">{selected.size} selected</span>
            <span className="text-muted-foreground">·</span>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => runBulkStatus(s)}
                className="rounded-md border border-border bg-background px-2.5 py-1 text-xs capitalize hover:bg-secondary"
              >
                Move to {s}
              </button>
            ))}
            <button
              onClick={runBulkDelete}
              className="ml-auto inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/25"
            >
              <Trash2 className="size-3" /> Delete
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}

        {/* List */}
        <div className="space-y-2">
          {filtered.length > 0 && (
            <button
              onClick={toggleAll}
              className="inline-flex items-center gap-2 px-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {allVisibleSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
              {allVisibleSelected ? "Unselect all" : "Select all"}
            </button>
          )}
          {filtered.map((c) => {
            const isSelected = selected.has(c.id);
            return (
              <div
                key={c.id}
                className={`flex items-center gap-3 rounded-xl border bg-card/60 p-4 transition ${
                  isSelected ? "border-primary ring-1 ring-primary/30" : "border-border"
                }`}
              >
                <button
                  onClick={() => toggleOne(c.id)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Select"
                >
                  {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
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
                  onChange={(e) => changeStatus(c.id, e.target.value as ContentStatus)}
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
          })}
          {filtered.length === 0 && (
            <EmptyState
              text={
                items.length === 0
                  ? "No content yet. Create your first draft above."
                  : "Nothing matches your filters."
              }
            />
          )}
        </div>
      </div>
    </PageTransition>
  );
}
