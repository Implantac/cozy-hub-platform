import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Sparkles } from "lucide-react";
import { PageTransition, stagger } from "@/components/app/Motion";
import { PageHeader } from "@/components/app/PageHeader";
import {
  addMemory,
  listMemories,
  listRecommendations,
  runBrainRecommend,
  updateRecommendation,
} from "@/lib/api/brain.functions";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import type { Memory, Recommendation } from "@/lib/api/_types";
import { MemoryPanel } from "@/features/brain/components/MemoryPanel";
import { RecommendationsPanel } from "@/features/brain/components/RecommendationsPanel";
import type { MemoryKind, RecStatus } from "@/features/brain/constants";

export const Route = createFileRoute("/_authenticated/app/brain")({
  component: BrainPage,
});

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

  const runMut = useWorkspaceMutation(() => run({ data: { workspaceId: wsId! } }), {
    invalidate: recsKey,
    successMessage: (r) => `${r.generated} recomendações geradas`,
  });

  const [memText, setMemText] = useState("");
  const [memKind, setMemKind] = useState<MemoryKind>("goal");
  const addMemMut = useWorkspaceMutation(
    () => addMem({ data: { workspaceId: wsId!, kind: memKind, content: memText } }),
    {
      invalidate: memKey,
      successMessage: "Memória salva",
      onSuccess: () => setMemText(""),
    },
  );

  const setRecStatus = (id: string, status: RecStatus) => {
    if (!wsId) return;
    updateRec({ data: { id, status, workspaceId: wsId } })
      .then(() => qc.invalidateQueries({ queryKey: recsKey }))
      .catch((e: Error) => {
        import("sonner").then(({ toast }) => toast.error(e.message));
      });
  };

  const recs = recsQ.data ?? [];
  const memories = memQ.data ?? [];

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <PageHeader
          icon={Brain}
          eyebrow="Cognitive layer · memória + regras"
          title="USE Brain Lab"
          subtitle="Camada cognitiva nativa — memória, sinais e recomendações que aprendem com sua operação."
          action={
            <button
              onClick={() => runMut.mutate()}
              disabled={runMut.isPending}
              className="hover-lift inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated disabled:opacity-60"
            >
              <Sparkles className={`size-4 ${runMut.isPending ? "animate-pulse" : ""}`} />
              {runMut.isPending ? "Pensando..." : "Executar Brain"}
            </button>
          }
        />

        <div className="grid gap-4 lg:grid-cols-5">
          <RecommendationsPanel recs={recs} onSetStatus={setRecStatus} />
          <MemoryPanel
            memories={memories}
            memText={memText}
            setMemText={setMemText}
            memKind={memKind}
            setMemKind={setMemKind}
            onSubmit={() => addMemMut.mutate()}
            isPending={addMemMut.isPending}
          />
        </div>
      </motion.div>
    </PageTransition>
  );
}
