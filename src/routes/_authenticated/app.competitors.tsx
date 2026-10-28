import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Plus, RadarIcon } from "lucide-react";
import { toast } from "sonner";
import { PageTransition, stagger } from "@/components/app/Motion";
import { ListSkeleton } from "@/components/app/Skeletons";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { BuilderService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { CompetitorRow } from "@/features/competitors/components/CompetitorRow";
import { ThreatMatrix } from "@/features/competitors/components/ThreatMatrix";
import { NewCompetitorDialog } from "@/features/competitors/components/NewCompetitorDialog";
import type { Competitor, CompetitorInput } from "@/features/competitors/types";

export const Route = createFileRoute("/_authenticated/app/competitors")({
  component: CompetitorRadarPage,
});

function CompetitorRadarPage() {
  const [wsId] = useCurrentWorkspaceId();
  const qc = useQueryClient();
  const list = useServerFn(BuilderService.listCompetitors);
  const upsert = useServerFn(BuilderService.upsertCompetitor);
  const del = useServerFn(BuilderService.deleteCompetitor);

  const q = useQuery({
    queryKey: ["competitors", wsId],
    queryFn: () => list({ data: { workspaceId: wsId! } }) as Promise<Competitor[]>,
    enabled: !!wsId,
  });

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "matrix">("list");

  const create = useMutation({
    mutationFn: (data: CompetitorInput) => upsert({ data: { workspaceId: wsId!, ...data } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitors", wsId] });
      setOpen(false);
      toast.success("Concorrente adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { workspaceId: wsId!, id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitors", wsId] });
      toast.success("Removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const competitors = q.data ?? [];

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <PageHeader
          icon={RadarIcon}
          eyebrow="Radar · inteligência competitiva"
          title="Concorrentes"
          subtitle="Quem está no seu radar, o que estão fazendo, onde você pode ganhar."
          action={
            <>
              <div className="inline-flex rounded-lg border border-border bg-card/60 p-0.5">
                <button
                  onClick={() => setView("list")}
                  className={`rounded-md px-3 py-1.5 text-xs transition ${view === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Lista
                </button>
                <button
                  onClick={() => setView("matrix")}
                  className={`rounded-md px-3 py-1.5 text-xs transition ${view === "matrix" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Matriz
                </button>
              </div>
              <button
                onClick={() => setOpen(true)}
                className="hover-lift inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated"
              >
                <Plus className="size-4" /> Adicionar
              </button>
            </>
          }
        />

        {q.isLoading ? (
          <ListSkeleton rows={4} />
        ) : competitors.length === 0 ? (
          <EmptyState
            variant="card"
            icon={RadarIcon}
            title="Radar vazio"
            text="Adicione concorrentes para acompanhar movimentos, gaps e oportunidades."
            action={
              <button
                onClick={() => setOpen(true)}
                className="hover-lift inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow"
              >
                <Plus className="size-4" /> Adicionar o primeiro
              </button>
            }
          />
        ) : view === "list" ? (
          <motion.section variants={stagger} className="space-y-3">
            {competitors.map((c) => (
              <CompetitorRow key={c.id} c={c} onRemove={() => remove.mutate(c.id)} />
            ))}
          </motion.section>
        ) : (
          <ThreatMatrix items={competitors} />
        )}

        {open && (
          <NewCompetitorDialog
            onClose={() => setOpen(false)}
            onSave={(data) => create.mutate(data)}
            saving={create.isPending}
          />
        )}
      </motion.div>
    </PageTransition>
  );
}
