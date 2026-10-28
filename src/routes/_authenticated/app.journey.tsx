import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Activity, Compass } from "lucide-react";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/Skeletons";
import { BrainEvolutionService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import type { Mentor, Period } from "@/features/journey/types";
import { MentorPanel } from "@/features/journey/components/MentorPanel";
import { PeriodsTimeline } from "@/features/journey/components/PeriodsTimeline";

export const Route = createFileRoute("/_authenticated/app/journey")({
  component: JourneyPage,
});

function JourneyPage() {
  const [wsId] = useCurrentWorkspaceId();
  const fetchTimeline = useServerFn(BrainEvolutionService.getLongTermTimeline);
  const q = useQuery({
    queryKey: ["journey", wsId],
    queryFn: () =>
      fetchTimeline({ data: { workspaceId: wsId! } }) as Promise<{
        periods: Period[];
        mentor: Mentor;
      }>,
    enabled: !!wsId,
  });

  const periods = q.data?.periods ?? [];
  const mentor = q.data?.mentor;
  const current =
    [...periods].reverse().find((p) => p.events_count > 0 || p.decisions_count > 0) ??
    periods[periods.length - 1];

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <motion.div variants={fadeUp}>
          <PageHeader
            icon={Compass}
            eyebrow="Journey · sua trajetória"
            title="Linha do tempo"
            subtitle="Trimestres reconstruídos a partir das suas decisões, experimentos e memória do Brain."
          />
        </motion.div>

        {mentor && <MentorPanel mentor={mentor} current={current} />}

        {q.isLoading ? (
          <ListSkeleton rows={4} />
        ) : periods.length === 0 ? (
          <EmptyState
            variant="dashed"
            icon={Activity}
            title="Sem histórico ainda"
            text="Comece registrando decisões e experimentos — a timeline se constrói sozinha."
          />
        ) : (
          <PeriodsTimeline periods={periods} />
        )}
      </motion.div>
    </PageTransition>
  );
}
