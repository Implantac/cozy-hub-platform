import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Megaphone, FileText, Palette, Radio, TrendingUp, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { HealthService } from "@/lib/services";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/app/health")({
  component: HealthPage,
});

const CAT_META: Record<string, { icon: React.ElementType; label: string }> = {
  marketing: { icon: Megaphone, label: "Marketing" },
  content: { icon: FileText, label: "Conteúdo" },
  brand: { icon: Palette, label: "Marca" },
  channel: { icon: Radio, label: "Canais" },
  growth: { icon: TrendingUp, label: "Crescimento" },
};

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
          {(q.data ?? []).map((h: any) => {
            const meta = CAT_META[h.category];
            const Icon = meta.icon;
            const tone = h.score >= 70 ? "text-success" : h.score >= 40 ? "text-primary" : "text-destructive";
            return (
              <motion.div key={h.id} variants={fadeUp} className="section-card hover-lift p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4 text-accent" /> {meta.label}
                  </div>
                  <div className={`text-2xl font-semibold tabular-nums tracking-tight ${tone}`}>{h.score}</div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${h.score}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full rounded-full bg-gradient-brand"
                  />
                </div>
                {(h.strengths?.length ?? 0) > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {h.strengths.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-success">
                        <Check className="size-3 mt-0.5 shrink-0" /> <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {(h.weaknesses?.length ?? 0) > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {h.weaknesses.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-destructive">
                        <AlertTriangle className="size-3 mt-0.5 shrink-0" /> <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            );
          })}
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
