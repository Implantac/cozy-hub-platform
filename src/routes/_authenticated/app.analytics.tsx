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
          title="Analytics"
          subtitle="Aggregated metrics, trends and channel comparison."
        />

        <div className="flex items-center gap-2">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                days === d
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              Last {d} days
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
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Criar conteúdo
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <Kpi icon={Eye} label="Impressions" value={data!.totals.impressions} />
              <Kpi icon={Heart} label="Engagement" value={data!.totals.engagement} />
              <Kpi icon={Users} label="Reach" value={data!.totals.reach} />
              <Kpi icon={TrendingUp} label="Snapshots" value={data!.totals.posts} />
            </div>

            <div className="rounded-2xl border border-border bg-card/60 p-5">
              <h3 className="mb-3 text-sm font-semibold">Engagement trend</h3>
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
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="engagement"
                      stroke="var(--primary)"
                      fill="url(#g1)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/60 p-5">
              <h3 className="mb-3 text-sm font-semibold">Impressions by platform</h3>
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
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="impressions" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">
        {value.toLocaleString()}
      </div>
    </div>
  );
}
