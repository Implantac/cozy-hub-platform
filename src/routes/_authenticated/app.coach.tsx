import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Lightbulb, AlertTriangle, Sparkles, Target, Check, X, Wand2 } from "lucide-react";
import { CoachService } from "@/lib/services";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/app/coach")({
  component: CoachPage,
});

const KIND_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  insight: { icon: Lightbulb, color: "text-accent", label: "Insight" },
  warning: { icon: AlertTriangle, color: "text-destructive", label: "Aviso" },
  suggestion: { icon: Sparkles, color: "text-primary", label: "Sugestão" },
  next_action: { icon: Target, color: "text-success", label: "Próxima ação" },
};

function CoachPage() {
  const list = useServerFn(CoachService.listRecommendations);
  const generate = useServerFn(CoachService.generateRecommendations);
  const update = useServerFn(CoachService.updateRecommendation);

  const q = useWorkspaceQuery(
    (wsId) => ["coach", wsId],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const wsId = q.wsId;
  const coachKey = wsId ? ["coach", wsId] : ["coach"];
  const gen = useWorkspaceMutation(
    () => generate({ data: { workspaceId: wsId! } }),
    { invalidate: coachKey, successMessage: (r: any) => `${r.generated} recomendações geradas` },
  );
  const act = useWorkspaceMutation(
    (v: { id: string; action: "dismiss" | "complete" }) => update({ data: v }),
    { invalidate: coachKey },
  );

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Wand2 className="size-3 text-accent"/> Growth Coach
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Recomendações para crescer</h1>
            <p className="mt-1 text-sm text-muted-foreground">Insights e próximas ações personalizadas com base na sua operação.</p>
          </div>
          <button onClick={() => gen.mutate()} disabled={gen.isPending || !wsId}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated disabled:opacity-60">
            <Sparkles className={`size-4 ${gen.isPending ? "animate-pulse" : ""}`}/>
            {gen.isPending ? "Analisando..." : "Gerar recomendações"}
          </button>
        </header>

        <motion.div variants={stagger} className="grid gap-3">
          {(q.data ?? []).map((r: any) => {
            const meta = KIND_META[r.kind] ?? KIND_META.suggestion;
            const Icon = meta.icon;
            return (
              <motion.div key={r.id} variants={fadeUp}
                className="group flex items-start gap-4 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur transition hover:border-primary/40">
                <div className={`grid size-10 shrink-0 place-items-center rounded-xl bg-background/60 ${meta.color}`}>
                  <Icon className="size-5"/>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
                    {r.severity && r.severity !== "info" && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">{r.severity}</span>
                    )}
                  </div>
                  <h3 className="mt-1 font-medium">{r.title}</h3>
                  {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                  {r.cta?.href && r.cta?.label && (
                    <Link to={r.cta.href}
                      className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90">
                      {r.cta.label} →
                    </Link>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => act.mutate({ id: r.id, action: "complete" })}
                    className="grid size-8 place-items-center rounded-lg text-success transition hover:bg-success/15" title="Marcar feito">
                    <Check className="size-4"/>
                  </button>
                  <button onClick={() => act.mutate({ id: r.id, action: "dismiss" })}
                    className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary" title="Dispensar">
                    <X className="size-4"/>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {q.data && q.data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 py-12 text-center text-sm text-muted-foreground">
            Nenhuma recomendação ativa. Clique em "Gerar recomendações" para analisar sua operação.
          </div>
        )}
      </motion.div>
    </PageTransition>
  );
}
