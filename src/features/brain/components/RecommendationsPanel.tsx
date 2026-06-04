import { Check, Sparkles, X } from "lucide-react";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionCard } from "@/components/app/SectionCard";
import type { Recommendation } from "@/lib/api/_types";
import type { RecStatus } from "../constants";

type Props = {
  recs: Recommendation[];
  onSetStatus: (id: string, status: RecStatus) => void;
};

export function RecommendationsPanel({ recs, onSetStatus }: Props) {
  return (
    <SectionCard
      className="lg:col-span-3"
      icon={Sparkles}
      title="Recomendações ativas"
      action={<span className="text-xs text-muted-foreground">{recs.filter(r => r.status === "open").length} abertas</span>}
    >
      {recs.length === 0 ? (
        <EmptyState
          variant="dashed"
          title="Sem recomendações ainda"
          text="Execute o Brain para gerar insights baseados na sua operação atual."
        />
      ) : (
        <ul className="space-y-2">
          {recs.map((r) => (
            <li
              key={r.id}
              className="group rounded-xl sm:rounded-2xl border border-border/50 bg-background/30 p-4 sm:p-5 transition-all duration-300 hover:border-primary/40 hover:bg-background/50 hover:shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold leading-snug text-foreground group-hover:text-primary transition-colors">{r.title}</div>
                  {r.rationale && (
                    <p className="mt-1 text-sm text-muted-foreground">{r.rationale}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-secondary/50 px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest capitalize text-muted-foreground">
                    {r.status}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    score {Number(r.score).toFixed(2)}
                  </span>
                </div>
              </div>
              {r.status === "open" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onSetStatus(r.id, "applied")}
                    className="inline-flex items-center gap-1 rounded-lg bg-success/15 px-3 py-1.5 text-xs font-medium text-success transition hover:bg-success/25"
                  >
                    <Check className="size-3" /> Aplicar
                  </button>
                  <button
                    onClick={() => onSetStatus(r.id, "dismissed")}
                    className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary/80"
                  >
                    <X className="size-3" /> Dispensar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
