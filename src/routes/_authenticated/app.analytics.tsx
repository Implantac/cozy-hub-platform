import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BarChart3, TrendingUp, Eye, Heart, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { StatTile } from "@/components/app/StatTile";
import { SectionCard } from "@/components/app/SectionCard";
import { StatGridSkeleton } from "@/components/app/Skeletons";
import { PageTransition } from "@/components/app/Motion";
import { Link } from "@tanstack/react-router";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { getAnalyticsOverview } from "@/lib/api/analytics.functions";

export const Route = createFileRoute("/_authenticated/app/analytics")({
  component: AnalyticsPage,
});

type Overview = Awaited<ReturnType<typeof getAnalyticsOverview>>;

function AnalyticsPage() {
  const fetchOverview = useServerFn(getAnalyticsOverview);
  const [days, setDays] = useState<7 | 30 | 90>(30);

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

        <div className="flex items-center gap-2" role="tablist" aria-label="Período">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={days === d}
              onClick={() => setDays(d)}
              className={`press rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                days === d
                  ? "border-primary/50 bg-primary/10 text-primary shadow-glow-sm"
                  : "border-border/70 bg-card/40 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              Últimos {d} dias
            </button>
          ))}
        </div>

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
            <div className="grid gap-3 md:grid-cols-4">
              <StatTile icon={Eye} label="Impressões" value={data!.totals.impressions.toLocaleString()} />
              <StatTile icon={Heart} label="Engajamento" value={data!.totals.engagement.toLocaleString()} />
              <StatTile icon={Users} label="Alcance" value={data!.totals.reach.toLocaleString()} />
              <StatTile icon={TrendingUp} label="Snapshots" value={data!.totals.posts.toLocaleString()} emphasis />
            </div>

            <SectionCard title="Tendência de engajamento" icon={TrendingUp}>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data!.daily}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                        boxShadow: "var(--shadow-card)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="engagement"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      fill="url(#g1)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Impressões por plataforma" icon={BarChart3}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data!.byPlatform}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="platform" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                        boxShadow: "var(--shadow-card)",
                      }}
                    />
                    <Bar dataKey="impressions" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </PageTransition>
  );
}
