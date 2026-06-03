import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { StatGridSkeleton } from "@/components/app/Skeletons";
import { PageTransition } from "@/components/app/Motion";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { getAnalyticsOverview } from "@/lib/api/analytics.functions";
import type { DaysOption } from "@/features/analytics/constants";
import { PeriodTabs } from "@/features/analytics/components/PeriodTabs";
import { AnalyticsTotals } from "@/features/analytics/components/AnalyticsTotals";
import { EngagementTrendChart } from "@/features/analytics/components/EngagementTrendChart";
import { PlatformImpressionsChart } from "@/features/analytics/components/PlatformImpressionsChart";

export const Route = createFileRoute("/_authenticated/app/analytics")({
  component: AnalyticsPage,
});

type Overview = Awaited<ReturnType<typeof getAnalyticsOverview>>;

function AnalyticsPage() {
  const fetchOverview = useServerFn(getAnalyticsOverview);
  const [days, setDays] = useState<DaysOption>(30);

  const q = useWorkspaceQuery<Overview>(
    (wsId) => ["analytics", wsId, days],
    ({ workspaceId }) => fetchOverview({ data: { workspaceId, days } }),
  );

  const data = q.data;
  const hasData = !!data && data.totals.posts > 0;

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={BarChart3}
          eyebrow="Analytics"
          title="Métricas, tendências e canais"
          subtitle="Agregue impressões, alcance e engajamento ao longo do tempo e compare canais."
        />

        <PeriodTabs days={days} onChange={setDays} />

        {q.isLoading ? (
          <StatGridSkeleton count={4} />
        ) : !hasData ? (
          <EmptyState
            variant="card"
            icon={BarChart3}
            title="Sem analytics ainda"
            text="Publique conteúdo para começar a coletar snapshots de impressões, alcance e engajamento."
            action={
              <Link
                to="/app/content"
                className="press inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Criar conteúdo
              </Link>
            }
          />
        ) : (
          <>
            <AnalyticsTotals totals={data!.totals} />
            <EngagementTrendChart daily={data!.daily} />
            <PlatformImpressionsChart byPlatform={data!.byPlatform} />
          </>
        )}
      </div>
    </PageTransition>
  );
}
