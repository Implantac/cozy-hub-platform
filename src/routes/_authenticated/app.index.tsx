import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Brain, Sparkles, Radio, Palette, FileText, Calendar,
  Target, Zap, TrendingUp, Activity, ArrowUpRight,
} from "lucide-react";
import { DashboardService, BrainService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { toast } from "sonner";
import { fadeUp, stagger, MotionCard, PageTransition } from "@/components/app/Motion";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { t } = useTranslation();
  const [wsId] = useCurrentWorkspaceId();
  const fetchOverview = useServerFn(
    // Service-layer indirection: components depend on services, not server fns.
    DashboardService.fetchOverview as unknown as Parameters<typeof useServerFn>[0],
  );
  // The service `fetchOverview(workspaceId)` is a sugar wrapper but the
  // underlying server fn signature is `{ data: { workspaceId } }`.
  // Keeping the original calling convention here for `useServerFn`.
  const recommend = useServerFn(BrainService.recommend as any);

  const q = useQuery({
    queryKey: ["dashboard", wsId],
    queryFn: () => (fetchOverview as any)({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
    refetchInterval: 30_000,
  });

  const recommendMut = useMutation({
    mutationFn: () => (recommend as any)({ data: { workspaceId: wsId! } }),
    onSuccess: (r: any) => {
      toast.success(t("dashboard.brainGenerated", { count: r.generated }));
      q.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!wsId || q.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          {t("common.loading")}
        </div>
      </div>
    );
  }

  const d = q.data!;
  const connectedPct = d.counts.channels === 0
    ? 0
    : Math.round((d.counts.channelsConnected / d.counts.channels) * 100);

  return (
    <PageTransition>
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="space-y-8"
      >
        <motion.header
          variants={fadeUp}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Activity className="size-3 text-success" />
              {t("dashboard.systemHealthy")}
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">
              {t("dashboard.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("dashboard.subtitle")}
            </p>
          </div>
          <button
            onClick={() => recommendMut.mutate()}
            disabled={recommendMut.isPending}
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated disabled:opacity-60"
          >
            <Sparkles className="size-4 transition group-hover:rotate-12" />
            {recommendMut.isPending ? t("dashboard.thinking") : t("dashboard.runBrain")}
          </button>
        </motion.header>

        {/* KPI grid */}
        <motion.section
          variants={stagger}
          className="grid grid-cols-2 gap-4 md:grid-cols-4"
        >
          <KpiCard
            icon={Palette}
            label={t("dashboard.stats.brands")}
            value={d.counts.brands}
            to="/app/brands"
            accent="from-violet-500/20 to-fuchsia-500/10"
          />
          <KpiCard
            icon={Radio}
            label={t("dashboard.stats.channels")}
            value={`${d.counts.channelsConnected}/${d.counts.channels}`}
            hint={`${connectedPct}% ${t("dashboard.stats.connected")}`}
            to="/app/channels"
            accent="from-sky-500/20 to-cyan-500/10"
          />
          <KpiCard
            icon={FileText}
            label={t("dashboard.stats.content")}
            value={d.counts.content}
            to="/app/content"
            accent="from-emerald-500/20 to-teal-500/10"
          />
          <KpiCard
            icon={Calendar}
            label={t("dashboard.stats.upcoming")}
            value={d.upcomingJobs.length}
            to="/app/scheduler"
            accent="from-amber-500/20 to-orange-500/10"
          />
        </motion.section>

        {/* Main panels */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            title={t("dashboard.panels.recommendations")}
            icon={Brain}
            action={<LinkAction to="/app/brain" label={t("common.viewAll")} />}
          >
            {d.recommendations.length === 0 ? (
              <Empty text={t("dashboard.panels.noRecs")} />
            ) : (
              <ul className="space-y-2">
                {d.recommendations.map((r: any) => (
                  <li
                    key={r.id}
                    className="group rounded-xl border border-border bg-background/40 p-4 transition hover:border-primary/40 hover:bg-background/60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{r.title}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-brain/15 px-2 py-0.5 text-xs text-brain">
                        <TrendingUp className="size-3" />
                        {Number(r.score).toFixed(2)}
                      </span>
                    </div>
                    {r.rationale && (
                      <p className="mt-1.5 text-sm text-muted-foreground">{r.rationale}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title={t("dashboard.panels.missions")}
            icon={Target}
            action={<LinkAction to="/app/missions" label={t("common.manage")} />}
          >
            {d.missions.length === 0 ? (
              <Empty text={t("dashboard.panels.noMissions")} />
            ) : (
              <ul className="space-y-2">
                {d.missions.map((m: any) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-3"
                  >
                    <span className="truncate text-sm">{m.title}</span>
                    <StatusPill status={m.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title={t("dashboard.panels.events")}
            icon={Zap}
            className="lg:col-span-2"
          >
            {d.events.length === 0 ? (
              <Empty text={t("dashboard.panels.noEvents")} />
            ) : (
              <ul className="divide-y divide-border">
                {d.events.map((e: any) => (
                  <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-mono text-xs text-accent">{e.event_type}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t("dashboard.panels.pipeline")} icon={FileText}>
            {Object.keys(d.contentByStatus).length === 0 ? (
              <Empty text={t("dashboard.panels.noContent")} />
            ) : (
              <div className="space-y-3">
                {Object.entries(d.contentByStatus).map(([k, v]) => {
                  const total = Object.values(d.contentByStatus).reduce(
                    (a: number, b) => a + (b as number), 0,
                  );
                  const pct = total === 0 ? 0 : Math.round(((v as number) / total) * 100);
                  return (
                    <div key={k}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="capitalize text-muted-foreground">{k}</span>
                        <span className="font-medium">{v as number}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-gradient-brand transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </section>
      </motion.div>
    </PageTransition>
  );
}

function KpiCard({
  icon: Icon, label, value, hint, to, accent,
}: {
  icon: LucideIcon; label: string; value: ReactValue; hint?: string;
  to?: string; accent?: string;
}) {
  const body = (
    <MotionCard
      className={`relative overflow-hidden rounded-2xl border border-border bg-card/60 p-5 backdrop-blur transition hover:border-primary/40 hover:shadow-glow`}
    >
      {accent && (
        <div
          className={`pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-gradient-to-br ${accent} blur-2xl`}
        />
      )}
      <div className="relative">
        <div className="flex items-center justify-between">
          <Icon className="size-5 text-accent" />
          {to && <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />}
        </div>
        <div className="mt-4 text-3xl font-semibold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground">
          {label}{hint ? ` · ${hint}` : ""}
        </div>
      </div>
    </MotionCard>
  );
  return to ? <Link to={to} className="group block">{body}</Link> : body;
}

type ReactValue = string | number;

function Panel({
  title, icon: Icon, action, children, className = "",
}: {
  title: string; icon: LucideIcon; action?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <motion.div variants={fadeUp} className={`rounded-2xl border border-border bg-card/60 p-5 backdrop-blur ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-accent" />
          {title}
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

function LinkAction({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-xs text-primary transition hover:underline"
    >
      {label} <ArrowUpRight className="size-3" />
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "done" ? "bg-success/15 text-success"
    : status === "in_progress" ? "bg-primary/15 text-primary"
    : status === "blocked" ? "bg-destructive/15 text-destructive"
    : "bg-secondary text-secondary-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${tone}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
