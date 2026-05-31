import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Brain, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listRecommendations, updateRecommendation, runBrainRecommend, listMemories, addMemory } from "@/lib/api/brain.functions";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { PageHeader } from "./app.brands";

export const Route = createFileRoute("/_authenticated/app/brain")({ component: BrainPage });

function BrainPage() {
  const [wsId] = useCurrentWorkspaceId();
  const qc = useQueryClient();
  const fetchRecs = useServerFn(listRecommendations);
  const updateRec = useServerFn(updateRecommendation);
  const run = useServerFn(runBrainRecommend);
  const fetchMem = useServerFn(listMemories);
  const addMem = useServerFn(addMemory);

  const recsQ = useQuery({ queryKey: ["recs", wsId], queryFn: () => fetchRecs({ data: { workspaceId: wsId! } }), enabled: !!wsId });
  const memQ = useQuery({ queryKey: ["mem", wsId], queryFn: () => fetchMem({ data: { workspaceId: wsId! } }), enabled: !!wsId });

  const runMut = useMutation({
    mutationFn: () => run({ data: { workspaceId: wsId! } }),
    onSuccess: (r) => { toast.success(`${r.generated} recommendations`); qc.invalidateQueries({ queryKey: ["recs", wsId] }); },
  });

  const [memText, setMemText] = useState("");
  const [memKind, setMemKind] = useState<"fact" | "goal" | "preference" | "strategy">("goal");
  const addMemMut = useMutation({
    mutationFn: () => addMem({ data: { workspaceId: wsId!, kind: memKind, content: memText } }),
    onSuccess: () => { setMemText(""); qc.invalidateQueries({ queryKey: ["mem", wsId] }); toast.success("Memory saved"); },
  });

  return (
    <div className="space-y-6">
      <PageHeader icon={Brain} title="Native Cognitive Brain" subtitle="Rule engine · memory layer · recommendations · learning signals." />

      <div className="flex justify-end">
        <button onClick={() => runMut.mutate()} disabled={runMut.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-brain px-4 py-2 text-sm font-medium text-brain-foreground shadow-glow hover:opacity-90 disabled:opacity-50">
          <Sparkles className="size-4" /> {runMut.isPending ? "Thinking..." : "Run Brain"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card/60 p-5">
          <h3 className="mb-3 text-sm font-medium">Recommendations</h3>
          <div className="space-y-2">
            {(recsQ.data ?? []).map((r: any) => (
              <div key={r.id} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{r.title}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{Number(r.score).toFixed(2)}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 capitalize">{r.status}</span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.rationale}</p>
                {r.status === "open" && (
                  <div className="mt-2 flex gap-2 text-xs">
                    <button onClick={() => updateRec({ data: { id: r.id, status: "applied" } }).then(() => qc.invalidateQueries({ queryKey: ["recs", wsId] }))}
                      className="rounded-md bg-success/20 px-2 py-1 text-success">Apply</button>
                    <button onClick={() => updateRec({ data: { id: r.id, status: "dismissed" } }).then(() => qc.invalidateQueries({ queryKey: ["recs", wsId] }))}
                      className="rounded-md bg-secondary px-2 py-1">Dismiss</button>
                  </div>
                )}
              </div>
            ))}
            {recsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No recommendations. Click Run Brain.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 p-5">
          <h3 className="mb-3 text-sm font-medium">Memory layer</h3>
          <form onSubmit={(e) => { e.preventDefault(); if (memText.length >= 2) addMemMut.mutate(); }} className="grid gap-2 md:grid-cols-[auto_1fr_auto]">
            <select value={memKind} onChange={(e) => setMemKind(e.target.value as any)} className="rounded-md border border-input bg-background px-2 py-2 text-sm">
              {["goal", "fact", "preference", "strategy"].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <input value={memText} onChange={(e) => setMemText(e.target.value)} placeholder="Remember..." className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Save</button>
          </form>
          <ul className="mt-4 space-y-1.5">
            {(memQ.data ?? []).map((m: any) => (
              <li key={m.id} className="flex items-start gap-2 rounded-md border border-border bg-background/40 p-2 text-sm">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">{m.kind}</span>
                <span className="flex-1">{m.content}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
