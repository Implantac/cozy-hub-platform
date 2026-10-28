import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { TrendingUp, RefreshCw } from "lucide-react";
import { ScoreService } from "@/lib/services";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { PageTransition, stagger } from "@/components/app/Motion";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { ScoreOverview } from "@/features/score/components/ScoreOverview";
import { ScoreGaps } from "@/features/score/components/ScoreGaps";

export const Route = createFileRoute("/_authenticated/app/score")({
  component: ScorePage,
});

function ScorePage() {
  const get = useServerFn(ScoreService.getLatestScore);
  const compute = useServerFn(ScoreService.computeDigitalScore);
  const q = useWorkspaceQuery(
    (wsId) => ["score", wsId],
    ({ workspaceId }) => get({ data: { workspaceId } }),
  );
  const wsId = q.wsId;
  const mut = useWorkspaceMutation(() => compute({ data: { workspaceId: wsId! } }), {
    invalidate: wsId ? ["score", wsId] : ["score"],
    successMessage: "Score recalculado",
  });

  const score = q.data as any;
  const gaps = Array.isArray(score?.breakdown?.gaps) ? (score.breakdown.gaps as string[]) : [];

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <PageHeader
          icon={TrendingUp}
          eyebrow="Digital Score"
          title="Sua pontuação digital"
          subtitle="Quanto maior, mais sólida sua operação digital. Atualize semanalmente."
          action={
            <Button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || !wsId}
              className="gap-2 bg-gradient-brand text-primary-foreground shadow-glow hover:shadow-elevated"
            >
              <RefreshCw className={`size-4 ${mut.isPending ? "animate-spin" : ""}`} />
              {mut.isPending ? "Calculando..." : "Recalcular"}
            </Button>
          }
        />

        {score && <ScoreOverview score={score} />}
        {score && <ScoreGaps gaps={gaps} />}

        {!score && (
          <EmptyState
            variant="card"
            icon={TrendingUp}
            title="Sem cálculo ainda"
            text="Clique em Recalcular para gerar seu Digital Score com base nos sinais atuais do seu workspace."
            action={
              <Button
                onClick={() => mut.mutate()}
                disabled={mut.isPending || !wsId}
                className="gap-2"
              >
                <RefreshCw className={`size-4 ${mut.isPending ? "animate-spin" : ""}`} />
                Calcular agora
              </Button>
            }
          />
        )}
      </motion.div>
    </PageTransition>
  );
}
