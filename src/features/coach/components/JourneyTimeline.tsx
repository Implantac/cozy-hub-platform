import { History } from "lucide-react";
import { ListSkeleton } from "@/components/app/Skeletons";
import type { Row } from "@/lib/brain/types";
import { MEMORY_META, SENTIMENT_ICON, formatWhen } from "../constants";

type Props = {
  events: Row<"brain_memory_events">[];
  isLoading: boolean;
};

export function JourneyTimeline({ events, isLoading }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="size-4 text-accent" />
        <h2 className="text-lg font-semibold tracking-tight">Sua jornada</h2>
        <span className="text-xs text-muted-foreground">
          · decisões, resultados e viradas que o Brain está usando como contexto
        </span>
      </div>

      {isLoading && <ListSkeleton rows={4} />}

      {!isLoading && events.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 py-10 text-center text-sm text-muted-foreground">
          Sua jornada ainda está vazia. Decisões, publicações e viradas no Navegador vão aparecer
          aqui.
        </div>
      )}

      <ol className="relative space-y-3 border-l border-border/70 pl-4">
        {events.map((evt) => {
          const meta = MEMORY_META[evt.kind] ?? MEMORY_META.signal;
          const Icon = meta.icon;
          const sentiment = evt.sentiment ? SENTIMENT_ICON[evt.sentiment] : null;
          const SIcon = sentiment?.icon;
          return (
            <li key={evt.id} className="relative">
              <span
                className={`absolute -left-[22px] top-2 grid size-4 place-items-center rounded-full border border-border bg-background ${meta.color}`}
              >
                <Icon className="size-2.5" />
              </span>
              <div className="rounded-xl border border-border bg-card/50 p-4">
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest">
                  <span className={meta.color}>{meta.label}</span>
                  <span className="text-muted-foreground">· {formatWhen(evt.created_at)}</span>
                  {SIcon && sentiment && (
                    <span className={`inline-flex items-center gap-1 ${sentiment.color}`}>
                      <SIcon className="size-3" />
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-foreground">{evt.subject}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
