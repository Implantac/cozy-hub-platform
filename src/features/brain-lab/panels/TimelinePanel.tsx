import { useServerFn } from "@tanstack/react-start";
import { History } from "lucide-react";
import { getLongTermTimeline } from "@/lib/api/brain-evolution.functions";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/Skeletons";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/50 p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

export function TimelinePanel() {
  const fetchTimeline = useServerFn(getLongTermTimeline);
  const tlQ = useWorkspaceQuery<Awaited<ReturnType<typeof fetchTimeline>>>(
    (ws) => ["brain-timeline", ws],
    ({ workspaceId }) => fetchTimeline({ data: { workspaceId } }),
  );

  if (!tlQ.wsId) {
    return <EmptyState text="Selecione um workspace para ver a linha do tempo." />;
  }
  if (tlQ.isLoading) {
    return <ListSkeleton rows={4} />;
  }
  const data = tlQ.data;
  if (!data || data.periods.length === 0) {
    return (
      <EmptyState
        variant="card"
        icon={History}
        title="Trajetória ainda em construção"
        text="Conforme você usar o sistema, o Mentor de Longo Prazo vai construir sua linha do tempo trimestre a trimestre."
      />
    );
  }

  const trajectory = data.mentor.trajectory_delta;
  const trajectoryColor =
    trajectory == null
      ? "text-muted-foreground"
      : trajectory > 10
        ? "text-emerald-500"
        : trajectory < -10
          ? "text-destructive"
          : "text-amber-500";

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-5">
        <header className="mb-3 flex items-center gap-2">
          <History className="size-5 text-primary" />
          <h3 className="text-lg font-semibold">Visão do Mentor</h3>
        </header>
        <p className="text-sm leading-relaxed text-foreground">{data.mentor.verdict}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Stat label="Períodos" value={String(data.mentor.periods_tracked)} />
          <Stat label="Eventos" value={String(data.mentor.total_events)} />
          <Stat label="Decisões" value={String(data.mentor.total_decisions)} />
          <Stat label="Experimentos OK" value={String(data.mentor.completed_experiments)} />
        </div>
        {trajectory != null && (
          <p className={`mt-3 text-sm font-medium ${trajectoryColor}`}>
            Trajetória: {trajectory > 0 ? "+" : ""}
            {trajectory.toFixed(1)} pts de score acumulado.
          </p>
        )}
        {data.mentor.patterns.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {data.mentor.patterns.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Linha do tempo
        </h4>
        <ol className="relative space-y-4 border-l border-border pl-5">
          {data.periods.map((p) => (
            <li key={p.key} className="relative">
              <span className="absolute -left-[27px] top-1 size-3 rounded-full bg-primary ring-4 ring-background" />
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="font-semibold">{p.key}</h5>
                  <div className="flex flex-wrap gap-1">
                    {p.highlights.map((h, i) => (
                      <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-sm text-foreground">{p.narrative}</p>
                {p.score_avg != null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Score médio: {p.score_avg.toFixed(1)}
                  </p>
                )}
                {(p.wins.length > 0 || p.setbacks.length > 0) && (
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {p.wins.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase text-emerald-500">Vitórias</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                          {p.wins.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {p.setbacks.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase text-destructive">Tropeços</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                          {p.setbacks.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
