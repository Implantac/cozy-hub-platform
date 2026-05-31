import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { listContent, createContent, updateContentStatus } from "@/lib/api/content.functions";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { PageHeader } from "./app.brands";

export const Route = createFileRoute("/_authenticated/app/content")({ component: ContentPage });

function ContentPage() {
  const [wsId] = useCurrentWorkspaceId();
  const qc = useQueryClient();
  const list = useServerFn(listContent);
  const create = useServerFn(createContent);
  const updateStatus = useServerFn(updateContentStatus);
  const q = useQuery({ queryKey: ["content", wsId], queryFn: () => list({ data: { workspaceId: wsId! } }), enabled: !!wsId });

  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const createMut = useMutation({
    mutationFn: () => create({ data: { workspaceId: wsId!, title, body, type: "post" } }),
    onSuccess: () => { setTitle(""); setBody(""); qc.invalidateQueries({ queryKey: ["content", wsId] }); toast.success("Draft created"); },
  });

  return (
    <div className="space-y-6">
      <PageHeader icon={FileText} title="Content" subtitle="Drafts, templates and AI-assisted creation." />

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your post..." rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button disabled={createMut.isPending} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"><Plus className="size-4"/>New draft</button>
        </form>
      </div>

      <div className="space-y-2">
        {(q.data ?? []).map((c: any) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-4">
            <div className="min-w-0">
              <div className="truncate font-medium">{c.title || "Untitled"}</div>
              <div className="text-xs text-muted-foreground">{c.brand?.name ?? "no brand"} · {c.type}</div>
            </div>
            <select
              value={c.status}
              onChange={(e) => updateStatus({ data: { id: c.id, status: e.target.value as any } }).then(() => qc.invalidateQueries({ queryKey: ["content", wsId] }))}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs capitalize"
            >
              {["draft", "scheduled", "published", "archived"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ))}
        {q.data?.length === 0 && <p className="text-sm text-muted-foreground">No content yet.</p>}
      </div>
    </div>
  );
}
