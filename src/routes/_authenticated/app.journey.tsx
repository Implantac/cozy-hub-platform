import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Compass, MapPin, Sparkles, TrendingUp, TrendingDown, Minus, Activity,
} from "lucide-react";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/Skeletons";
import { BrainEvolutionService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";

export const Route = createFileRoute("/_authenticated/app/journey")({
  component: JourneyPage,
});

type Period = {
  key: string; year: number; quarter: number;
  starts_at: string; ends_at: string;
  events_count: number; decisions_count: number; experiments_count: number;
  wins: string[]; setbacks: string[];
  score_avg: number | null;
  highlights: string[]; narrative: string;
};
type Mentor = {
  periods_tracked: number; total_events: number; total_decisions: number;
  completed_experiments: number; trajectory_delta: number | null;
  verdict: string; patterns: string[];
};

function JourneyPage() {
  const [wsId] = useCurrentWorkspaceId();
  const fetchTimeline = useServerFn(BrainEvolutionService.getLongTermTimeline);
  const q = useQuery({
    queryKey: ["journey", wsId],
    queryFn: () => fetchTimeline({ data: { workspaceId: wsId! } }) as Promise<{ periods: Period[]; mentor: Mentor }>,
    enabled: !!wsId,
  });

  const periods = q.data?.periods ?? [];
  const mentor = q.data?.mentor;
  const current = [...periods].reverse().find((p) => p.events_count > 0 || p.decisions_count > 0) ?? periods[periods.length - 1];

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

        {/* Mentor verdict */}
        {mentor && (
          <motion.section variants={fadeUp} className="section-card p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Veredicto do mentor</div>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed">{mentor.verdict}</p>
              </div>
              {current && (
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Período atual</div>
                  <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                    <MapPin className="size-3" /> {current.key}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
              <Metric label="Períodos" value={mentor.periods_tracked} />
              <Metric label="Eventos" value={mentor.total_events} />
              <Metric label="Decisões" value={mentor.total_decisions} />
              <Metric label="Experimentos" value={mentor.completed_experiments} />
              <Metric label="Trajetória"
                value={mentor.trajectory_delta == null ? "—" : `${mentor.trajectory_delta > 0 ? "+" : ""}${mentor.trajectory_delta.toFixed(1)}`}
                accent={mentor.trajectory_delta != null && mentor.trajectory_delta > 0 ? "success"
                      : mentor.trajectory_delta != null && mentor.trajectory_delta < 0 ? "destructive" : "muted-foreground"} />
            </div>
            {mentor.patterns.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {mentor.patterns.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Sparkles className="mt-0.5 size-3 shrink-0 text-accent" /> {p}
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        )}

        {/* Timeline */}
        {q.isLoading ? (
          <ListSkeleton rows={4} />
        ) : periods.length === 0 ? (
          <Empty />
        ) : (
          <motion.section variants={stagger} className="relative">
            <div className="absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-border via-border to-transparent" />
            <div className="space-y-4">
              {periods.map((p) => <PeriodRow key={p.key} period={p} />)}
            </div>
          </motion.section>
        )}
      </motion.div>
    </PageTransition>
  );
}

function PeriodRow({ period: p }: { period: Period }) {
  const trendIcon = p.score_avg == null ? Minus : p.events_count > 0 ? TrendingUp : Minus;
  const TIcon = trendIcon;
  return (
    <motion.div variants={fadeUp} className="relative flex gap-4">
      <div className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary ring-2 ring-primary/30">
        <TIcon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1 section-card hover-lift p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">{p.key}</div>
          <div className="flex flex-wrap gap-1.5">
            {p.highlights.map((h, i) => (
              <span key={i} className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">{h}</span>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.narrative}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Mini label="Eventos" value={p.events_count} />
          <Mini label="Decisões" value={p.decisions_count} />
          <Mini label="Experimentos" value={p.experiments_count} />
          <Mini label="Score médio" value={p.score_avg?.toFixed(0) ?? "—"} />
        </div>
      </div>
    </motion.div>
  );
}

function Metric({ label, value, accent = "foreground" }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums text-${accent}`}>{value}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/30 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Empty() {
  return (
    <EmptyState
      variant="dashed"
      icon={Activity}
      title="Sem histórico ainda"
      text="Comece registrando decisões e experimentos — a timeline se constrói sozinha."
    />
  );
}
