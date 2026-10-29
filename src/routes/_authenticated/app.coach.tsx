import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { CoachService, BrainCoreService } from "@/lib/services";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { useBrainRealtime } from "@/lib/brain/use-brain-realtime";
import { PageTransition } from "@/components/app/Motion";
import { stagger } from "@/components/app/motion-presets";
import { PageHeader } from "@/components/app/PageHeader";
import { RecommendationsList } from "@/features/coach/components/RecommendationsList";
import { JourneyTimeline } from "@/features/coach/components/JourneyTimeline";

export const Route = createFileRoute("/_authenticated/app/coach")({
  component: CoachPage,
});

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

  const coachKey = wsId ? ["coach", wsId] : ["coach"];

  const gen = useWorkspaceMutation(() => brainRecommend({ data: { workspaceId: wsId! } }), {
    invalidate: coachKey,
    successMessage: (r) => `${r.generated} recomendações geradas pelo Brain`,
  });
  const act = useWorkspaceMutation(
    (v: { id: string; action: "dismiss" | "complete" }) =>
      update({ data: { ...v, workspaceId: wsId! } }),
    { invalidate: coachKey },
  );

  const onGenerate = async () => {
    await gen.mutateAsync();
    // Regenerar recomendações muda a memória do Brain: a timeline precisa
    // refletir os novos eventos. Falha aqui não deve bloquear a UI.
    tl.refetch().catch(() => undefined);
  };

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-8">
        <PageHeader
          icon={Brain}
          eyebrow="USE Brain · Growth Coach"
          title="Recomendações para crescer"
          subtitle="Insights e próximas ações personalizadas pelo Brain a partir da sua operação e da sua jornada."
          action={
            <button
              onClick={onGenerate}
              disabled={gen.isPending || !wsId}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated disabled:opacity-60"
            >
              <Sparkles className={`size-4 ${gen.isPending ? "animate-pulse" : ""}`} />
              {gen.isPending ? "Analisando..." : "Gerar recomendações"}
            </button>
          }
        />

        <motion.div variants={stagger} className="grid gap-3">
          <RecommendationsList recs={q.data ?? []} onAct={(v) => act.mutate(v)} />
        </motion.div>

        {q.data && q.data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 py-12 text-center text-sm text-muted-foreground">
            Nenhuma recomendação ativa. Clique em "Gerar recomendações" para o Brain analisar sua
            operação.
          </div>
        )}

        <JourneyTimeline events={tl.data ?? []} isLoading={tl.isLoading} />
      </motion.div>
    </PageTransition>
  );
}
