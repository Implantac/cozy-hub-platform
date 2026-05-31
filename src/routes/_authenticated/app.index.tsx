import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Brain, Sparkles, Radio, Palette, FileText, Calendar, Target, Zap } from "lucide-react";
import { getDashboard } from "@/lib/api/dashboard.functions";
import { runBrainRecommend } from "@/lib/api/brain.functions";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { t } = useTranslation();
  const [wsId] = useCurrentWorkspaceId();
  const fetch = useServerFn(getDashboard);
  const recommend = useServerFn(runBrainRecommend);

  const q = useQuery({
    queryKey: ["dashboard", wsId],
    queryFn: () => fetch({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });

  const recommendMut = useMutation({
    mutationFn: () => recommend({ data: { workspaceId: wsId! } }),
    onSuccess: (r) => { toast.success(`Brain generated ${r.generated} recommendations`); q.refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!wsId || q.isLoading) return <div className="text-muted-foreground">Loading...</div>;
  const d = q.data!;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Command Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your digital operation, at a glance.</p>
        </div>
        <button
          onClick={() => recommendMut.mutate()}
          disabled={recommendMut.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-brain px-4 py-2 text-sm font-medium text-brain-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles className="size-4" /> {recommendMut.isPending ? "Thinking..." : "Run Brain"}
        </button>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Palette} label="Brands" value={d.counts.brands} to="/app/brands" />
        <StatCard icon={Radio} label="Channels" value={`${d.counts.channelsConnected}/${d.counts.channels}`} hint="connected" to="/app/channels" />
        <StatCard icon={FileText} label="Content" value={d.counts.content} to="/app/content" />
        <StatCard icon={Calendar} label="Upcoming" value={d.upcomingJobs.length} to="/app/scheduler" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Brain · Recommendations" icon={Brain} action={<Link to="/app/brain" className="text-xs text-primary hover:underline">View all</Link>}>
          {d.recommendations.length === 0 ? (
            <Empty text="No recommendations yet. Click Run Brain to generate." />
          ) : (
            <ul className="space-y-2">
              {d.recommendations.map((r: any) => (
                <li key={r.id} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{r.title}</span>
                    <span className="text-xs text-muted-foreground">score {Number(r.score).toFixed(2)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.rationale}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Missions" icon={Target} action={<Link to="/app/missions" className="text-xs text-primary hover:underline">Manage</Link>}>
          {d.missions.length === 0 ? <Empty text="No active missions." /> : (
            <ul className="space-y-2">
              {d.missions.map((m: any) => (
                <li key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-3">
                  <span>{m.title}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize text-secondary-foreground">{m.status.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Event stream" icon={Zap}>
          {d.events.length === 0 ? <Empty text="No events yet." /> : (
            <ul className="space-y-1.5">
              {d.events.map((e: any) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-xs text-accent">{e.event_type}</span>
                  <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Content pipeline" icon={FileText}>
          {Object.keys(d.contentByStatus).length === 0 ? <Empty text="No content yet." /> : (
            <div className="space-y-2">
              {Object.entries(d.contentByStatus).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted-foreground">{k}</span>
                  <span className="font-medium">{v as number}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, to }: any) {
  const Body = (
    <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur transition hover:border-primary/40">
      <Icon className="size-5 text-accent" />
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground">{label}{hint ? ` · ${hint}` : ""}</div>
    </div>
  );
  return to ? <Link to={to}>{Body}</Link> : Body;
}

function Panel({ title, icon: Icon, action, children }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-accent" />
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">{text}</div>;
}
