import { FileText, Zap } from "lucide-react";
import { Empty, Panel } from "../components/atoms";
import type { Row } from "@/lib/brain/types";

/**
 * The dashboard query selects four columns, not the whole row — so the prop
 * declares the projection. Typing it as the full row would promise
 * `workspace_id` and `processed_at`, which never arrive.
 */
export type ActivityEvent = Pick<
  Row<"domain_events">,
  "id" | "event_type" | "payload" | "created_at"
>;

type Props = { events: ActivityEvent[]; contentByStatus: Record<string, number> };

export function ActivityPipelineSection({ events, contentByStatus }: Props) {
  const total = Object.values(contentByStatus).reduce((a: number, b) => a + (b as number), 0);
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <Panel title="Atividade recente" icon={Zap} className="lg:col-span-2">
        {events.length === 0 ? (
          <Empty text="Sem eventos ainda." />
        ) : (
          <ul className="divide-y divide-border/40">
            {events.slice(0, 8).map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between py-2.5 sm:py-3 text-sm transition-colors hover:bg-white/5 px-2 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-accent animate-soft-pulse" />
                  <span className="font-mono text-xs font-medium text-accent">{e.event_type}</span>
                </div>
                <span className="text-[11px] font-medium text-muted-foreground/70">
                  {new Date(e.created_at).toLocaleString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Pipeline de conteúdo" icon={FileText}>
        {Object.keys(contentByStatus).length === 0 ? (
          <Empty text="Sem conteúdo ainda." />
        ) : (
          <div className="space-y-3">
            {Object.entries(contentByStatus).map(([k, v]) => {
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
  );
}
