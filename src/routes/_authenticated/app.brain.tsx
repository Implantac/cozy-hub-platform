import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Brain, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import {
  addMemory,
  listMemories,
  listRecommendations,
  runBrainRecommend,
  updateRecommendation,
} from "@/lib/api/brain.functions";
import {
  useWorkspaceMutation,
  useWorkspaceQuery,
} from "@/lib/query/use-workspace-query";
import type { Memory, Recommendation } from "@/lib/api/_types";

export const Route = createFileRoute("/_authenticated/app/brain")({
  component: BrainPage,
});

type MemoryKind = "fact" | "goal" | "preference" | "strategy";
type RecStatus = "open" | "applied" | "dismissed" | "expired";
const MEMORY_KINDS: readonly MemoryKind[] = [
  "goal",
  "fact",
  "preference",
  "strategy",
] as const;

function BrainPage() {
  const qc = useQueryClient();
  const fetchRecs = useServerFn(listRecommendations);
  const updateRec = useServerFn(updateRecommendation);
  const run = useServerFn(runBrainRecommend);
  const fetchMem = useServerFn(listMemories);
  const addMem = useServerFn(addMemory);

  const recsQ = useWorkspaceQuery<Recommendation[]>(
    (wsId) => ["recs", wsId],
    ({ workspaceId }) => fetchRecs({ data: { workspaceId } }),
  );
  const memQ = useWorkspaceQuery<Memory[]>(
    (wsId) => ["mem", wsId],
    ({ workspaceId }) => fetchMem({ data: { workspaceId } }),
  );
  const wsId = recsQ.wsId;
  const recsKey = wsId ? ["recs", wsId] : ["recs"];
  const memKey = wsId ? ["mem", wsId] : ["mem"];

  const runMut = useWorkspaceMutation(
    () => run({ data: { workspaceId: wsId! } }),
    {
      invalidate: recsKey,
      successMessage: (r) => `${r.generated} recommendations`,
    },
  );

  const [memText, setMemText] = useState("");
  const [memKind, setMemKind] = useState<MemoryKind>("goal");
  const addMemMut = useWorkspaceMutation(
    () => addMem({ data: { workspaceId: wsId!, kind: memKind, content: memText } }),
    {
      invalidate: memKey,
      successMessage: "Memory saved",
      onSuccess: () => setMemText(""),
    },
  );

  const setRecStatus = (id: string, status: RecStatus) =>
    updateRec({ data: { id, status } }).then(() =>
      qc.invalidateQueries({ queryKey: recsKey }),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Brain}
        title="Native Cognitive Brain"
        subtitle="Rule engine · memory layer · recommendations · learning signals."
      />

      <div className="flex justify-end">
        <button
          onClick={() => runMut.mutate()}
          disabled={runMut.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-brain px-4 py-2 text-sm font-medium text-brain-foreground shadow-glow hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles className="size-4" />{" "}
          {runMut.isPending ? "Thinking..." : "Run Brain"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card/60 p-5">
          <h3 className="mb-3 text-sm font-medium">Recommendations</h3>
          <div className="space-y-2">
            {(recsQ.data ?? []).map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-border bg-background/40 p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{r.title}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {Number(r.score).toFixed(2)}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 capitalize">
                      {r.status}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {r.rationale}
                </p>
                {r.status === "open" && (
                  <div className="mt-2 flex gap-2 text-xs">
                    <button
                      onClick={() => setRecStatus(r.id, "applied")}
                      className="rounded-md bg-success/20 px-2 py-1 text-success"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => setRecStatus(r.id, "dismissed")}
                      className="rounded-md bg-secondary px-2 py-1"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
            {recsQ.data?.length === 0 && (
              <EmptyState text="No recommendations. Click Run Brain." />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 p-5">
          <h3 className="mb-3 text-sm font-medium">Memory layer</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (memText.length >= 2) addMemMut.mutate();
            }}
            className="grid gap-2 md:grid-cols-[auto_1fr_auto]"
          >
            <select
              value={memKind}
              onChange={(e) => setMemKind(e.target.value as MemoryKind)}
              className="rounded-md border border-input bg-background px-2 py-2 text-sm"
            >
              {MEMORY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              value={memText}
              onChange={(e) => setMemText(e.target.value)}
              placeholder="Remember..."
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              Save
            </button>
          </form>
          <ul className="mt-4 space-y-1.5">
            {(memQ.data ?? []).map((m) => (
              <li
                key={m.id}
                className="flex items-start gap-2 rounded-md border border-border bg-background/40 p-2 text-sm"
              >
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">
                  {m.kind}
                </span>
                <span className="flex-1">{m.content}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
