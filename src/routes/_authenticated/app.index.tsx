import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import {
  CoachService,
  HealthService,
  OpportunitiesService,
  BrainCoreService,
  BuilderService,
  BrainEvolutionService,
} from "@/lib/services";
import { getDashboard } from "@/lib/api/dashboard.functions";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { useBrainRealtime } from "@/lib/brain/use-brain-realtime";
import { toast } from "sonner";
import { PageTransition } from "@/components/app/Motion";
import { stagger } from "@/components/app/motion-presets";
import { PageSkeleton } from "@/components/app/Skeletons";
import { FiveQuestionsSection } from "@/features/dashboard/sections/FiveQuestionsSection";
import { OsLayersSection } from "@/features/dashboard/sections/OsLayersSection";
import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader";
import { TopRowSection } from "@/features/dashboard/sections/TopRowSection";
import { CoachMissionsSection } from "@/features/dashboard/sections/CoachMissionsSection";
import { ActivityPipelineSection } from "@/features/dashboard/sections/ActivityPipelineSection";
import { KpiFooterSection } from "@/features/dashboard/sections/KpiFooterSection";

export const Route = createFileRoute("/_authenticated/app/")({
  component: GPSDashboard,
});

function GPSDashboard() {
  const [wsId] = useCurrentWorkspaceId();
  useBrainRealtime(wsId);
  const fetchOverview = useServerFn(getDashboard);
  const brainAskAll = useServerFn(BrainCoreService.brainAskAll);
  const brainSnapshot = useServerFn(BrainCoreService.brainSnapshot);
  const brainRecommend = useServerFn(BrainCoreService.brainRecommend);
  const listRecs = useServerFn(CoachService.listRecommendations);
  const getHealth = useServerFn(HealthService.getLatestHealth);
  const listOpps = useServerFn(OpportunitiesService.listOpportunities);
  const getBlueprint = useServerFn(BuilderService.getBlueprint);
  const listCompetitors = useServerFn(BuilderService.listCompetitors);
  const listSkills = useServerFn(BrainEvolutionService.listSkillAssessments);
  const getTimeline = useServerFn(BrainEvolutionService.getLongTermTimeline);

  const overview = useQuery({
    queryKey: ["dashboard", wsId],
    queryFn: () => fetchOverview({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
    refetchInterval: 30_000,
  });
  const brain = useQuery({
    queryKey: ["brain-all", wsId],
    queryFn: () => brainAskAll({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });
  const recs = useQuery({
    queryKey: ["recs", wsId],
    queryFn: () => listRecs({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });
  const health = useQuery({
    queryKey: ["health", wsId],
    queryFn: () => getHealth({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });
  const opps = useQuery({
    queryKey: ["opps-preview", wsId],
    queryFn: () => listOpps({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });
  const blueprint = useQuery({
    queryKey: ["blueprint-mini", wsId],
    queryFn: () =>
      getBlueprint({ data: { workspaceId: wsId! } }) as Promise<Record<
        string,
        string | null
      > | null>,
    enabled: !!wsId,
  });
  const competitors = useQuery({
    queryKey: ["competitors-mini", wsId],
    queryFn: () => listCompetitors({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });
  const skills = useQuery({
    queryKey: ["skills-mini", wsId],
    queryFn: () => listSkills({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });
  const journey = useQuery({
    queryKey: ["journey-mini", wsId],
    queryFn: () => getTimeline({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });

  const refreshAll = useMutation({
    mutationFn: async () => {
      await brainSnapshot({ data: { workspaceId: wsId! } });
      await brainRecommend({ data: { workspaceId: wsId! } });
    },
    onSuccess: () => {
      toast.success("USE Brain atualizado");
      brain.refetch();
      recs.refetch();
      overview.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!wsId || overview.isLoading) {
    return <PageSkeleton stats={4} rows={4} />;
  }

  const d = overview.data!;
  const s = brain.data?.scores;
  const topRecs = (recs.data ?? []).slice(0, 4);
  const trending = (opps.data ?? [])
    .filter((o) => o.status === "exploding" || o.status === "growing")
    .slice(0, 3);
  const healthList = health.data ?? [];
  const healthAvg =
    healthList.length > 0
      ? Math.round(healthList.reduce((a, h) => a + (h?.score ?? 0), 0) / healthList.length)
      : null;
  const priorityMissions = (d.missions ?? []).filter((m) => m.status !== "done").slice(0, 4);

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <DashboardHeader onRefresh={() => refreshAll.mutate()} isPending={refreshAll.isPending} />

        <FiveQuestionsSection answers={brain.data?.answers ?? []} loading={brain.isLoading} />

        <TopRowSection
          scoreOverall={s?.overall ?? 0}
          healthAvg={healthAvg}
          health={healthList}
          trending={trending}
        />

        <CoachMissionsSection topRecs={topRecs} priorityMissions={priorityMissions} />

        <ActivityPipelineSection events={d.events} contentByStatus={d.contentByStatus} />

        <OsLayersSection
          blueprint={blueprint.data}
          competitors={competitors.data}
          skills={skills.data}
          journey={journey.data}
        />

        <KpiFooterSection
          brands={d.counts.brands}
          channelsConnected={d.counts.channelsConnected}
          channels={d.counts.channels}
          content={d.counts.content}
          scheduled={d.upcomingJobs.length}
        />

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="size-3 text-success" /> Sistema operacional · atualização em tempo
          real ativa
        </div>
      </motion.div>
    </PageTransition>
  );
}
