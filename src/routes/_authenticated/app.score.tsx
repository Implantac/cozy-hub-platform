import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, RefreshCw } from "lucide-react";
import { ScoreService } from "@/lib/services";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";
import { ScoreGauge } from "@/components/app/ScoreGauge";
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
        <header className="flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <TrendingUp className="size-3 text-accent"/> Digital Score
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Sua pontuação digital</h1>
            <p className="mt-1 text-sm text-muted-foreground">Quanto maior, mais sólida sua operação digital. Atualize semanalmente.</p>
          </div>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !wsId}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated disabled:opacity-60">
            <RefreshCw className={`size-4 ${mut.isPending ? "animate-spin" : ""}`}/>
            {mut.isPending ? "Calculando..." : "Recalcular"}
          </button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[auto,1fr]">
          <motion.div variants={fadeUp} className="grid place-items-center rounded-2xl border border-border bg-card/60 p-8 backdrop-blur">
            <ScoreGauge value={score?.overall ?? 0} size={240}/>
          </motion.div>
          <motion.div variants={fadeUp} className="grid gap-3 sm:grid-cols-2">
            {PILLARS.map(p => {
              const v = (score?.[p.key as keyof typeof score] as number) ?? 0;
              return (
                <div key={p.key} className="rounded-xl border border-border bg-card/60 p-4 backdrop-blur">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{p.label}</span>
                    <span className="font-mono font-semibold">{v}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${v}%` }}
                      transition={{ duration: 0.8, ease: [0.22,1,0.36,1] }}
                      className="h-full rounded-full bg-gradient-brand"/>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </div>

        {score?.breakdown && Array.isArray((score.breakdown as any).gaps) && (score.breakdown as any).gaps.length > 0 && (
          <motion.div variants={fadeUp} className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
            <div className="mb-3 text-sm font-medium">Como subir cada pilar</div>
            <ul className="space-y-2">
              {((score.breakdown as any).gaps as string[]).map((g, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3 text-sm">
                  <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i+1}</span>
                  {g}
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {!score && (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 py-12 text-center text-sm text-muted-foreground">
            Nenhum cálculo ainda. Clique em "Recalcular" para gerar seu Digital Score.
          </div>
        )}
      </motion.div>
    </PageTransition>
  );
}
