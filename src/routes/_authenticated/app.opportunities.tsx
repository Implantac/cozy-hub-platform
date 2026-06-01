import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Radar, Flame, ArrowUp, Minus, AlertCircle, TrendingDown, Brain } from "lucide-react";
import { OpportunitiesService, BrainCoreService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { PageTransition, fadeUp, stagger, MotionCard } from "@/components/app/Motion";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/app/opportunities")({
  component: OpportunitiesPage,
});

const STATUS = [
  { id: undefined, label: "Todas" },
  { id: "exploding", label: "Em explosão" },
  { id: "growing", label: "Crescendo" },
  { id: "stable", label: "Estável" },
  { id: "saturated", label: "Saturado" },
  { id: "declining", label: "Em queda" },
] as const;

const STATUS_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  exploding: { icon: Flame, color: "text-destructive", label: "Em explosão" },
  growing: { icon: ArrowUp, color: "text-success", label: "Crescendo" },
  stable: { icon: Minus, color: "text-primary", label: "Estável" },
  saturated: { icon: AlertCircle, color: "text-accent", label: "Saturado" },
  declining: { icon: TrendingDown, color: "text-muted-foreground", label: "Em queda" },
};

function OpportunitiesPage() {
  const [wsId] = useCurrentWorkspaceId();
  const [status, setStatus] = useState<typeof STATUS[number]["id"]>(undefined);
  const listGeneric = useServerFn(OpportunitiesService.listOpportunities);
  const listBrain = useServerFn(BrainCoreService.brainOpportunities);
  const q = useQuery({
    queryKey: ["opps", wsId, status],
    queryFn: () =>
      wsId
        ? listBrain({ data: { workspaceId: wsId, status: status as any } })
        : listGeneric({ data: { workspaceId: undefined, status: status as any } }),
  });

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <header>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Brain className="size-3 text-accent"/> Opportunity Radar · ranqueado pelo USE Brain
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Oportunidades de mercado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nichos emergentes e tendências, ordenados pela compatibilidade com o seu perfil, canais e objetivos.
          </p>
        </header>


        <div className="flex flex-wrap gap-2">
          {STATUS.map(s => (
            <button key={s.label} onClick={() => setStatus(s.id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                status === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}>{s.label}</button>
          ))}
        </div>

        <motion.div variants={stagger} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(q.data ?? []).map((o: any) => {
            const meta = STATUS_META[o.status];
            const Icon = meta.icon;
            return (
              <MotionCard key={o.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card/60 p-5 backdrop-blur transition hover:border-primary/40">
                <div className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-2xl opacity-0 transition group-hover:opacity-100"/>
                <div className="relative space-y-3">
                  <div className="flex items-start justify-between">
                    <div className={`inline-flex items-center gap-1.5 rounded-full bg-background/60 px-2.5 py-0.5 text-xs ${meta.color}`}>
                      <Icon className="size-3"/> {meta.label}
                    </div>
                    {o.niche && <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{o.niche}</span>}
                  </div>
                  <h3 className="text-lg font-medium leading-snug">{o.title}</h3>
                  {o.description && <p className="text-sm text-muted-foreground">{o.description}</p>}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <Metric label="Dificuldade" value={o.difficulty}/>
                    <Metric label="Competição" value={o.competition}/>
                    <Metric label="Potencial" value={o.growth_potential}/>
                  </div>
                  {Array.isArray(o.actions) && o.actions.length > 0 && (
                    <ul className="space-y-1 border-t border-border pt-3">
                      {o.actions.map((a: any, i: number) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="size-1 rounded-full bg-primary"/> {a.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </MotionCard>
            );
          })}
        </motion.div>

        {q.data && q.data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 py-12 text-center text-sm text-muted-foreground">
            Nenhuma oportunidade nesse filtro.
          </div>
        )}
      </motion.div>
    </PageTransition>
  );
}

function Metric({ label, value }: { label: string; value: "low"|"medium"|"high" }) {
  const tone = value === "high" ? "text-success" : value === "medium" ? "text-primary" : "text-muted-foreground";
  const txt = value === "high" ? "Alto" : value === "medium" ? "Médio" : "Baixo";
  return (
    <div className="rounded-lg bg-background/40 p-2 text-center">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-xs font-semibold ${tone}`}>{txt}</div>
    </div>
  );
}
