import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Brain, Sparkles, Radio, Palette, FileText, Calendar,
  Target, Zap, TrendingUp, Activity, ArrowUpRight, Compass,
  AlertTriangle, Lightbulb, CheckCircle2, Flame, Heart,
  MapPin, Flag, Shield, Rocket, GitBranch,
} from "lucide-react";
import {
  CoachService, HealthService, OpportunitiesService, BrainCoreService,
} from "@/lib/services";
import { getDashboard } from "@/lib/api/dashboard.functions";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { toast } from "sonner";
import { fadeUp, stagger, MotionCard, PageTransition } from "@/components/app/Motion";
import { ScoreGauge } from "@/components/app/ScoreGauge";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  component: GPSDashboard,
});

function GPSDashboard() {
  const [wsId] = useCurrentWorkspaceId();
  const fetchOverview = useServerFn(getDashboard);
  const brainAskAll = useServerFn(BrainCoreService.brainAskAll);
  const brainSnapshot = useServerFn(BrainCoreService.brainSnapshot);
  const brainRecommend = useServerFn(BrainCoreService.brainRecommend);
  const listRecs = useServerFn(CoachService.listRecommendations);
  const getHealth = useServerFn(HealthService.getLatestHealth);
  const listOpps = useServerFn(OpportunitiesService.listOpportunities);

  const overview = useQuery({
    queryKey: ["dashboard", wsId],
    queryFn: () => (fetchOverview as any)({ data: { workspaceId: wsId! } }),
    enabled: !!wsId, refetchInterval: 30_000,
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

  const refreshAll = useMutation({
    mutationFn: async () => {
      await brainSnapshot({ data: { workspaceId: wsId! } });
      await brainRecommend({ data: { workspaceId: wsId! } });
    },
    onSuccess: () => {
      toast.success("USE Brain atualizado");
      brain.refetch(); recs.refetch(); overview.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!wsId || overview.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          Carregando GPS...
        </div>
      </div>
    );
  }

  const d = overview.data!;
  const s = brain.data?.scores as any;
  const topRecs = (recs.data ?? []).slice(0, 4);
  const trending = (opps.data ?? []).filter((o: any) => o.status === "exploding" || o.status === "growing").slice(0, 3);
  const healthAvg = health.data && health.data.length > 0
    ? Math.round(health.data.reduce((a: number, h: any) => a + h.score, 0) / health.data.length)
    : null;
  const priorityMissions = (d.missions ?? []).filter((m: any) => m.status !== "done").slice(0, 4);

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        {/* Header */}
        <motion.header variants={fadeUp} className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Compass className="size-3 text-accent" />
              Business GPS · cockpit operacional
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">USE Brain</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O cérebro do seu negócio digital — sempre respondendo as 5 perguntas que importam.
            </p>
          </div>
          <button
            onClick={() => refreshAll.mutate()}
            disabled={refreshAll.isPending}
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated disabled:opacity-60"
          >
            <Brain className={`size-4 transition group-hover:rotate-12 ${refreshAll.isPending ? "animate-pulse" : ""}`} />
            {refreshAll.isPending ? "Pensando..." : "Pensar de novo"}
          </button>
        </motion.header>

        {/* Five Questions — the soul of USE Brain */}
        <motion.section variants={stagger} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            { q: "where_am_i", icon: MapPin, label: "Onde estou?" },
            { q: "where_to_go", icon: Flag, label: "Onde quero chegar?" },
            { q: "whats_blocking", icon: Shield, label: "O que me impede?" },
            { q: "next_action", icon: Rocket, label: "Próxima ação" },
            { q: "should_pivot", icon: GitBranch, label: "Devo mudar?" },
          ].map((card) => {
            const a = (brain.data?.answers ?? []).find((x: any) => x.question === card.q);
            const Icon = card.icon;
            return (
              <motion.div key={card.q} variants={fadeUp}
                className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-4 backdrop-blur transition hover:border-primary/40">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <Icon className="size-3 text-accent" /> {card.label}
                </div>
                <div className="mt-2 text-sm font-semibold leading-snug">
                  {a?.headline ?? (brain.isLoading ? "Analisando..." : "—")}
                </div>
                {a?.body && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>}
                {a?.cta && (
                  <Link to={a.cta.href} className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                    {a.cta.label} <ArrowUpRight className="size-3" />
                  </Link>
                )}
                {typeof a?.confidence === "number" && (
                  <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${Math.round(a.confidence * 100)}%` }} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.section>


        {/* Top row — Score + Health summary + Goal */}
        <section className="grid gap-4 lg:grid-cols-[auto,1fr,1fr]">
          <motion.div variants={fadeUp} className="grid place-items-center rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
            <ScoreGauge value={s?.overall ?? 0} size={200} label="Digital Score" />
            <Link to="/app/score" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
              Ver detalhes <ArrowUpRight className="size-3" />
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Heart className="size-4 text-accent" /> Saúde do negócio
              </div>
              <Link to="/app/health" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                Diagnóstico <ArrowUpRight className="size-3" />
              </Link>
            </div>
            {healthAvg === null ? (
              <Empty text="Calcule sua saúde no módulo Health." />
            ) : (
              <>
                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-4xl font-bold tabular-nums">{healthAvg}</span>
                  <span className="text-xs text-muted-foreground">/ 100 — média geral</span>
                </div>
                <div className="space-y-2">
                  {(health.data ?? []).map((h: any) => (
                    <div key={h.id}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="capitalize text-muted-foreground">{h.category}</span>
                        <span className="font-mono">{h.score}</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${h.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>

          <motion.div variants={fadeUp} className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Flame className="size-4 text-accent" /> Oportunidades em alta
              </div>
              <Link to="/app/opportunities" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                Explorar <ArrowUpRight className="size-3" />
              </Link>
            </div>
            {trending.length === 0 ? (
              <Empty text="Sem tendências capturadas ainda." />
            ) : (
              <ul className="space-y-2">
                {trending.map((o: any) => (
                  <li key={o.id} className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium">{o.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                        o.status === "exploding" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
                      }`}>{o.status}</span>
                    </div>
                    {o.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{o.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        </section>

        {/* Coach recommendations + Priority missions */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            title="Próximos passos do Coach"
            icon={Brain}
            action={<LinkAction to="/app/coach" label="Abrir Coach" />}
          >
            {topRecs.length === 0 ? (
              <Empty text="Sem recomendações ativas. Clique em Atualizar GPS para gerar." />
            ) : (
              <ul className="space-y-2">
                {topRecs.map((r: any) => (
                  <li key={r.id} className="rounded-xl border border-border bg-background/40 p-4 transition hover:border-primary/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <RecIcon kind={r.kind} />
                        <div>
                          <div className="font-medium">{r.title}</div>
                          {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                        </div>
                      </div>
                      <SeverityPill severity={r.severity} />
                    </div>
                    {r.cta?.href && (
                      <Link to={r.cta.href} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        {r.cta.label ?? "Abrir"} <ArrowUpRight className="size-3" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Missões prioritárias"
            icon={Target}
            action={<LinkAction to="/app/missions" label="Gerenciar" />}
          >
            {priorityMissions.length === 0 ? (
              <Empty text="Nenhuma missão pendente." />
            ) : (
              <ul className="space-y-2">
                {priorityMissions.map((m: any) => (
                  <li key={m.id} className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-3">
                    <span className="truncate text-sm">{m.title}</span>
                    <StatusPill status={m.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>

        {/* Activity + Pipeline */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Atividade recente" icon={Zap} className="lg:col-span-2">
            {d.events.length === 0 ? (
              <Empty text="Sem eventos ainda." />
            ) : (
              <ul className="divide-y divide-border">
                {d.events.slice(0, 8).map((e: any) => (
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

          <Panel title="Pipeline de conteúdo" icon={FileText}>
            {Object.keys(d.contentByStatus).length === 0 ? (
              <Empty text="Sem conteúdo ainda." />
            ) : (
              <div className="space-y-3">
                {Object.entries(d.contentByStatus).map(([k, v]) => {
                  const total = Object.values(d.contentByStatus).reduce((a: number, b) => a + (b as number), 0);
                  const pct = total === 0 ? 0 : Math.round(((v as number) / total) * 100);
                  return (
                    <div key={k}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="capitalize text-muted-foreground">{k}</span>
                        <span className="font-medium">{v as number}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </section>

        {/* KPI footer */}
        <motion.section variants={stagger} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard icon={Palette} label="Marcas" value={d.counts.brands} to="/app/brands" />
          <KpiCard icon={Radio} label="Canais"
            value={`${d.counts.channelsConnected}/${d.counts.channels}`}
            to="/app/channels" />
          <KpiCard icon={FileText} label="Conteúdos" value={d.counts.content} to="/app/content" />
          <KpiCard icon={Calendar} label="Agendados" value={d.upcomingJobs.length} to="/app/scheduler" />
        </motion.section>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="size-3 text-success" /> Sistema operacional · atualização em tempo real ativa
        </div>
      </motion.div>
    </PageTransition>
  );
}

function RecIcon({ kind }: { kind: string }) {
  const map: Record<string, { icon: LucideIcon; color: string }> = {
    warning: { icon: AlertTriangle, color: "text-destructive" },
    insight: { icon: TrendingUp, color: "text-primary" },
    suggestion: { icon: Lightbulb, color: "text-accent" },
    next_action: { icon: CheckCircle2, color: "text-success" },
  };
  const m = map[kind] ?? map.insight;
  const I = m.icon;
  return (
    <div className={`grid size-8 shrink-0 place-items-center rounded-lg bg-background/60 ${m.color}`}>
      <I className="size-4" />
    </div>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const tone =
    severity === "critical" || severity === "high" ? "bg-destructive/15 text-destructive"
    : severity === "medium" ? "bg-primary/15 text-primary"
    : "bg-secondary text-secondary-foreground";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${tone}`}>{severity}</span>;
}

function KpiCard({
  icon: Icon, label, value, hint, to,
}: { icon: LucideIcon; label: string; value: string | number; hint?: string; to?: string }) {
  const body = (
    <MotionCard className="relative overflow-hidden rounded-xl border border-border bg-card/60 p-4 backdrop-blur transition hover:border-primary/40">
      <div className="flex items-center justify-between">
        <Icon className="size-4 text-accent" />
        {to && <ArrowUpRight className="size-3 text-muted-foreground" />}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}{hint ? ` · ${hint}` : ""}</div>
    </MotionCard>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

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
    <Link to={to} className="inline-flex items-center gap-1 text-xs text-primary transition hover:underline">
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
    <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
