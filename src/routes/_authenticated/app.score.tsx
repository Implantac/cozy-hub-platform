import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, RefreshCw } from "lucide-react";
import { ScoreService } from "@/lib/services";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";
import { ScoreGauge } from "@/components/app/ScoreGauge";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/app/score")({
  component: ScorePage,
});

const PILLARS = [
  { key: "presence", label: "Presença" },
  { key: "branding", label: "Branding" },
  { key: "content", label: "Conteúdo" },
  { key: "consistency", label: "Consistência" },
  { key: "growth", label: "Crescimento" },
  { key: "channel_setup", label: "Setup de Canais" },
] as const;

function ScorePage() {
  const get = useServerFn(ScoreService.getLatestScore);
  const compute = useServerFn(ScoreService.computeDigitalScore);
  const q = useWorkspaceQuery(
    (wsId) => ["score", wsId],
    ({ workspaceId }) => get({ data: { workspaceId } }),
  );
  const wsId = q.wsId;
  const mut = useWorkspaceMutation(
    () => compute({ data: { workspaceId: wsId! } }),
    { invalidate: wsId ? ["score", wsId] : ["score"], successMessage: "Score recalculado" },
  );

  const score = q.data;

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

        <div className="grid gap-6 lg:grid-cols-[auto,1fr]">
          <motion.div variants={fadeUp} className="section-card grid place-items-center p-8">
            <ScoreGauge value={score?.overall ?? 0} size={240} />
          </motion.div>
          <motion.div variants={fadeUp} className="grid gap-3 sm:grid-cols-2">
            {PILLARS.map((p) => {
              const v = (score?.[p.key as keyof typeof score] as number) ?? 0;
              return (
                <div key={p.key} className="stat-tile">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{p.label}</span>
                    <span className="font-mono font-semibold tabular-nums">{v}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${v}%` }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full bg-gradient-brand"
                    />
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>

        {score?.breakdown && Array.isArray((score.breakdown as any).gaps) && (score.breakdown as any).gaps.length > 0 && (
          <motion.div variants={fadeUp} className="section-card p-5 md:p-6">
            <div className="mb-3 text-sm font-medium tracking-tight">Como subir cada pilar</div>
            <ul className="space-y-2">
              {((score.breakdown as any).gaps as string[]).map((g, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/40 p-3 text-sm leading-relaxed">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>
                  {g}
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {!score && (
          <EmptyState
            variant="card"
            icon={TrendingUp}
            title="Sem cálculo ainda"
            text="Clique em Recalcular para gerar seu Digital Score com base nos sinais atuais do seu workspace."
            action={
              <Button onClick={() => mut.mutate()} disabled={mut.isPending || !wsId} className="gap-2">
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
