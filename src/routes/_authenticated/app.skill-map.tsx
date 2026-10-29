import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Brain, CheckCircle2, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageTransition } from "@/components/app/Motion";
import { stagger } from "@/components/app/motion-presets";
import { PageHeader } from "@/components/app/PageHeader";
import { BrainEvolutionService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { AREAS, type AreaId } from "@/features/skill-map/constants";
import { SkillStat } from "@/features/skill-map/components/SkillStat";
import { SkillCard } from "@/features/skill-map/components/SkillCard";

export const Route = createFileRoute("/_authenticated/app/skill-map")({
  component: SkillMapPage,
});

function SkillMapPage() {
  const [wsId] = useCurrentWorkspaceId();
  const qc = useQueryClient();
  const list = useServerFn(BrainEvolutionService.listSkillAssessments);
  const upsert = useServerFn(BrainEvolutionService.upsertSkillAssessment);

  const q = useQuery({
    queryKey: ["skills", wsId],
    queryFn: () => list({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });

  const mut = useMutation({
    mutationFn: (p: { area: AreaId; score: number }) =>
      upsert({ data: { workspaceId: wsId!, area: p.area, score: p.score, source: "self" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["skills", wsId] });
      toast.success("Avaliação salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const latest = new Map<AreaId, { score: number; assessed_at: string }>();
  for (const a of (q.data ?? []) as Array<{ area: AreaId; score: number; assessed_at: string }>) {
    if (!latest.has(a.area)) latest.set(a.area, { score: a.score, assessed_at: a.assessed_at });
  }

  const scored = AREAS.map((a) => ({ ...a, score: latest.get(a.id)?.score ?? null }));
  const mastered = scored.filter((s) => (s.score ?? 0) >= 80).length;
  const learning = scored.filter((s) => s.score != null && s.score < 80 && s.score >= 30).length;
  const next = scored.find((s) => s.score != null && s.score < 80);

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <PageHeader
          icon={Brain}
          eyebrow="Skill Map · capacidades do operador"
          title="Suas habilidades"
          subtitle="Avalie de 0 a 100 em cada área. O Brain usa isso pra recomendar o próximo passo."
        />

        <motion.section variants={stagger} className="grid gap-3 md:grid-cols-3">
          <SkillStat label="Dominadas" value={mastered} icon={CheckCircle2} />
          <SkillStat label="Em construção" value={learning} icon={TrendingUp} />
          <SkillStat
            label="Próximo foco"
            value={next?.label ?? "Tudo dominado"}
            icon={Target}
            small
          />
        </motion.section>

        <motion.section variants={stagger} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scored.map((s) => (
            <SkillCard
              key={s.id}
              area={s}
              pending={mut.isPending}
              onScore={(score) => mut.mutate({ area: s.id, score })}
            />
          ))}
        </motion.section>
      </motion.div>
    </PageTransition>
  );
}
