import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Megaphone, FileText, Palette, Radio, TrendingUp, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { HealthService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";
import { motion } from "framer-motion";
import { toast } from "sonner";

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
  const [wsId] = useCurrentWorkspaceId();
  const get = useServerFn(HealthService.getLatestHealth);
  const compute = useServerFn(HealthService.computeHealth);
  const q = useQuery({ queryKey: ["health", wsId], queryFn: () => get({ data: { workspaceId: wsId! }}), enabled: !!wsId });
  const mut = useMutation({
    mutationFn: () => compute({ data: { workspaceId: wsId! }}),
    onSuccess: () => { toast.success("Saúde atualizada"); q.refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <header className="flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Activity className="size-3 text-accent"/> Business Health
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Saúde do seu negócio digital</h1>
            <p className="mt-1 text-sm text-muted-foreground">Diagnóstico claro por área. Foque nas fraquezas que mais impactam crescimento.</p>
          </div>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !wsId}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated disabled:opacity-60">
            <RefreshCw className={`size-4 ${mut.isPending ? "animate-spin" : ""}`}/>
            {mut.isPending ? "Calculando..." : "Atualizar"}
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(q.data ?? []).map((h: any) => {
            const meta = CAT_META[h.category];
            const Icon = meta.icon;
            const tone = h.score >= 70 ? "text-success" : h.score >= 40 ? "text-primary" : "text-destructive";
            return (
              <motion.div key={h.id} variants={fadeUp} className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="size-4 text-accent"/> {meta.label}
                  </div>
                  <div className={`text-2xl font-bold tabular-nums ${tone}`}>{h.score}</div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${h.score}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full rounded-full bg-gradient-brand"/>
                </div>
                {(h.strengths?.length ?? 0) > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {h.strengths.map((s: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-success">
                        <Check className="size-3"/> {s}
                      </li>
                    ))}
                  </ul>
                )}
                {(h.weaknesses?.length ?? 0) > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {h.weaknesses.map((s: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-destructive">
                        <AlertTriangle className="size-3"/> {s}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            );
          })}
        </div>

        {q.data && q.data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 py-12 text-center text-sm text-muted-foreground">
            Clique em "Atualizar" para gerar o diagnóstico de saúde do negócio.
          </div>
        )}
      </motion.div>
    </PageTransition>
  );
}
