import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PageTransition } from "@/components/app/Motion";
import {
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
const STATUSES: readonly ContentStatus[] = [
  "draft",
  "scheduled",
  "published",
  "archived",
] as const;

function ContentPage() {
  const qc = useQueryClient();
  const list = useServerFn(listContent);
  const create = useServerFn(createContent);
  const updateStatus = useServerFn(updateContentStatus);

  const q = useWorkspaceQuery<Content[]>(
    (wsId) => ["content", wsId],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const invalidateKey = q.wsId ? ["content", q.wsId] : ["content"];

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const createMut = useWorkspaceMutation(
    () =>
      create({
        data: { workspaceId: q.wsId!, title, body, type: "post" },
      }),
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
      .catch((e: Error) => {
        // surface so failed status changes do not silently disappear
        import("sonner").then(({ toast }) => toast.error(e.message));
      });
  };

  return (
    <PageTransition>
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Content"
        subtitle="Drafts, templates and AI-assisted creation."
      />

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate();
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
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="size-4" />New draft
          </button>
        </form>
      </div>

      <div className="space-y-2">
        {(q.data ?? []).map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-4"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">{c.title || "Untitled"}</div>
              <div className="text-xs text-muted-foreground">
                {c.brand?.name ?? "no brand"} · {c.type}
              </div>
            </div>
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
        ))}
        {q.data?.length === 0 && <EmptyState text="No content yet." />}
      </div>
    </div>
    </PageTransition>
  );
}
