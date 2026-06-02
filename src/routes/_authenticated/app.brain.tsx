import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Brain, Sparkles, Check, X, Target, Flag, Star, Compass, Plus,
} from "lucide-react";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
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

const MEMORY_META: Record<MemoryKind, { icon: React.ElementType; color: string; label: string }> = {
  goal:       { icon: Flag,    color: "text-primary",     label: "Objetivo" },
  fact:       { icon: Compass, color: "text-accent",      label: "Fato" },
  preference: { icon: Star,    color: "text-success",     label: "Preferência" },
  strategy:   { icon: Target,  color: "text-destructive", label: "Estratégia" },
};

const MEMORY_KINDS: readonly MemoryKind[] = ["goal", "fact", "preference", "strategy"] as const;

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
      successMessage: (r) => `${r.generated} recomendações geradas`,
    },
  );

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
        <motion.header variants={fadeUp} className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Brain className="size-3 text-accent" /> Cognitive layer · memória + regras
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">USE Brain Lab</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Camada cognitiva nativa — memória, sinais e recomendações que aprendem com sua operação.
            </p>
          </div>
          <button
            onClick={() => runMut.mutate()}
            disabled={runMut.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated disabled:opacity-60"
          >
            <Sparkles className={`size-4 ${runMut.isPending ? "animate-pulse" : ""}`} />
            {runMut.isPending ? "Pensando..." : "Executar Brain"}
          </button>
        </motion.header>

        <div className="grid gap-4 lg:grid-cols-5">
          {/* Recommendations */}
          <motion.section variants={fadeUp} className="lg:col-span-3 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4 text-accent" /> Recomendações ativas
              </div>
              <span className="text-xs text-muted-foreground">{recs.filter(r => r.status === "open").length} abertas</span>
            </div>

            {recs.length === 0 ? (
              <EmptyState
                variant="dashed"
                title="Sem recomendações ainda"
                text="Execute o Brain para gerar insights baseados na sua operação atual."
              />
            ) : (
              <ul className="space-y-2">
                {recs.map((r) => (
                  <li
                    key={r.id}
                    className="group rounded-xl border border-border bg-background/40 p-4 transition hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-snug">{r.title}</div>
                        {r.rationale && (
                          <p className="mt-1 text-sm text-muted-foreground">{r.rationale}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-widest capitalize text-muted-foreground">
                          {r.status}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          score {Number(r.score).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {r.status === "open" && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setRecStatus(r.id, "applied")}
                          className="inline-flex items-center gap-1 rounded-lg bg-success/15 px-3 py-1.5 text-xs font-medium text-success transition hover:bg-success/25"
                        >
                          <Check className="size-3" /> Aplicar
                        </button>
                        <button
                          onClick={() => setRecStatus(r.id, "dismissed")}
                          className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary/80"
                        >
                          <X className="size-3" /> Dispensar
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </motion.section>

          {/* Memory layer */}
          <motion.section variants={fadeUp} className="lg:col-span-2 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium">
              <Brain className="size-4 text-accent" /> Camada de memória
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (memText.length >= 2) addMemMut.mutate();
              }}
              className="space-y-2"
            >
              <div className="flex flex-wrap gap-1.5">
                {MEMORY_KINDS.map((k) => {
                  const meta = MEMORY_META[k];
                  const Icon = meta.icon;
                  const active = memKind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setMemKind(k)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <Icon className="size-3" /> {meta.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  value={memText}
                  onChange={(e) => setMemText(e.target.value)}
                  placeholder="Ex.: Meta de R$ 10k/mês até dezembro..."
                  className="flex-1 rounded-lg border border-input bg-background/40 px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={memText.length < 2 || addMemMut.isPending}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  <Plus className="size-3.5" /> Salvar
                </button>
              </div>
            </form>

            {memories.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-card/30 py-6 text-center text-xs text-muted-foreground">
                Nenhuma memória registrada ainda.
              </div>
            ) : (
              <ul className="mt-4 space-y-1.5">
                {memories.map((m) => {
                  const meta = MEMORY_META[m.kind as MemoryKind] ?? MEMORY_META.fact;
                  const Icon = meta.icon;
                  return (
                    <li
                      key={m.id}
                      className="flex items-start gap-2 rounded-lg border border-border bg-background/40 p-2.5 text-sm transition hover:border-primary/40"
                    >
                      <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-background/60 ${meta.color}`}>
                        <Icon className="size-3" />
                      </span>
                      <span className="flex-1 leading-snug">{m.content}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.section>
        </div>
      </motion.div>
    </PageTransition>
  );
}
