import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Activity, RefreshCw } from "lucide-react";
import { HealthService } from "@/lib/services";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { PageTransition, stagger } from "@/components/app/Motion";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { HealthCategoryCard } from "@/features/health/components/HealthCategoryCard";

export const Route = createFileRoute("/_authenticated/app/health")({
  component: HealthPage,
});

function HealthPage() {
  const get = useServerFn(HealthService.getLatestHealth);
  const compute = useServerFn(HealthService.computeHealth);
  const q = useWorkspaceQuery(
    (wsId) => ["health", wsId],
    ({ workspaceId }) => get({ data: { workspaceId } }),
  );
  const wsId = q.wsId;
  const mut = useWorkspaceMutation(
    () => compute({ data: { workspaceId: wsId! } }),
    { invalidate: wsId ? ["health", wsId] : ["health"], successMessage: "Saúde atualizada" },
  );

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <PageHeader
          icon={Activity}
          eyebrow="Business Health"
          title="Saúde do seu negócio digital"
          subtitle="Diagnóstico claro por área. Foque nas fraquezas que mais impactam crescimento."
          action={
            <Button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || !wsId}
              className="gap-2 bg-gradient-brand text-primary-foreground shadow-glow hover:shadow-elevated"
            >
              <RefreshCw className={`size-4 ${mut.isPending ? "animate-spin" : ""}`} />
              {mut.isPending ? "Calculando..." : "Atualizar"}
            </Button>
          }
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(q.data ?? []).map((h: any) => (
            <HealthCategoryCard key={h.id} h={h} />
          ))}
        </div>

        {q.data && q.data.length === 0 && (
          <EmptyState
            variant="card"
            icon={Activity}
            title="Sem diagnóstico ainda"
            text="Clique em Atualizar para gerar o diagnóstico de saúde do negócio."
            action={
              <Button onClick={() => mut.mutate()} disabled={mut.isPending || !wsId} className="gap-2">
                <RefreshCw className={`size-4 ${mut.isPending ? "animate-spin" : ""}`} />
                Atualizar agora
              </Button>
            }
          />
        )}
      </motion.div>
    </PageTransition>
  );
}
