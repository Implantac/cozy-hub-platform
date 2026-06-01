import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Lightbulb, AlertTriangle, Sparkles, Target, Check, X, Wand2,
  Brain, TrendingUp, TrendingDown, Minus, History,
} from "lucide-react";
import { CoachService, BrainCoreService } from "@/lib/services";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { useBrainRealtime } from "@/lib/brain/use-brain-realtime";
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

const MEMORY_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  decision: { icon: Check, color: "text-success", label: "Decisão" },
  result: { icon: Target, color: "text-primary", label: "Resultado" },
  pivot: { icon: TrendingUp, color: "text-accent", label: "Virada de direção" },
  signal: { icon: Brain, color: "text-muted-foreground", label: "Sinal do Brain" },
  reflection: { icon: Lightbulb, color: "text-accent", label: "Reflexão" },
};

const SENTIMENT_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  positive: { icon: TrendingUp, color: "text-success" },
  neutral: { icon: Minus, color: "text-muted-foreground" },
  negative: { icon: TrendingDown, color: "text-destructive" },
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function CoachPage() {
  const list = useServerFn(CoachService.listRecommendations);
  const brainRecommend = useServerFn(BrainCoreService.brainRecommend);
  const update = useServerFn(CoachService.updateRecommendation);
  const timeline = useServerFn(BrainCoreService.brainTimeline);
  const [wsId] = useCurrentWorkspaceId();
  useBrainRealtime(wsId);

  const q = useWorkspaceQuery(
    (wsId) => ["coach", wsId],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const tl = useWorkspaceQuery(
    (wsId) => ["coach-timeline", wsId],
    ({ workspaceId }) => timeline({ data: { workspaceId } }),
  );

  const wsId = q.wsId;
  const coachKey = wsId ? ["coach", wsId] : ["coach"];
  const timelineKey = wsId ? ["coach-timeline", wsId] : ["coach-timeline"];

  const gen = useWorkspaceMutation(
    () => brainRecommend({ data: { workspaceId: wsId! } }),
    {
      invalidate: coachKey,
      successMessage: (r: any) => `${r.generated} recomendações geradas pelo Brain`,
    },
  );
  const act = useWorkspaceMutation(
    (v: { id: string; action: "dismiss" | "complete" }) =>
      update({ data: { ...v, workspaceId: wsId! } }),
    { invalidate: coachKey },
  );

  // When new recs are generated, the timeline gets a "signal" event — refresh it too
  const onGenerate = async () => {
    await gen.mutateAsync();
    // best-effort refresh; ignore failure
    try { await (tl as any).refetch?.(); } catch {}
  };

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Brain className="size-3 text-accent"/> USE Brain · Growth Coach
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Recomendações para crescer</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Insights e próximas ações personalizadas pelo Brain a partir da sua operação e da sua jornada.
            </p>
          </div>
          <button
            onClick={onGenerate}
            disabled={gen.isPending || !wsId}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated disabled:opacity-60"
          >
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
            Nenhuma recomendação ativa. Clique em "Gerar recomendações" para o Brain analisar sua operação.
          </div>
        )}

        {/* Sua jornada — timeline da memória do Brain */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="size-4 text-accent"/>
            <h2 className="text-lg font-semibold tracking-tight">Sua jornada</h2>
            <span className="text-xs text-muted-foreground">
              · decisões, resultados e viradas que o Brain está usando como contexto
            </span>
          </div>

          {tl.isLoading && (
            <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
              Carregando memória...
            </div>
          )}

          {!tl.isLoading && (tl.data ?? []).length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card/30 py-10 text-center text-sm text-muted-foreground">
              Sua jornada ainda está vazia. Decisões, publicações e viradas no Navegador vão aparecer aqui.
            </div>
          )}

          <ol className="relative space-y-3 border-l border-border/70 pl-4">
            {(tl.data ?? []).map((evt: any) => {
              const meta = MEMORY_META[evt.kind] ?? MEMORY_META.signal;
              const Icon = meta.icon;
              const sentiment = evt.sentiment ? SENTIMENT_ICON[evt.sentiment] : null;
              const SIcon = sentiment?.icon;
              return (
                <li key={evt.id} className="relative">
                  <span className={`absolute -left-[22px] top-2 grid size-4 place-items-center rounded-full border border-border bg-background ${meta.color}`}>
                    <Icon className="size-2.5"/>
                  </span>
                  <div className="rounded-xl border border-border bg-card/50 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest">
                      <span className={meta.color}>{meta.label}</span>
                      <span className="text-muted-foreground">· {formatWhen(evt.created_at)}</span>
                      {SIcon && sentiment && (
                        <span className={`inline-flex items-center gap-1 ${sentiment.color}`}>
                          <SIcon className="size-3"/>
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-foreground">{evt.subject}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </motion.div>
    </PageTransition>
  );
}
