import type { Row } from "@/lib/brain/types";
import { readLabels } from "@/lib/json";

/**
 * An opportunity as the Brain ranks it: the row plus the two fields the ranking
 * adds. Declared here rather than inlined so the card and the list agree.
 */
/**
 * Two sources feed this card: `brainOpportunities` (ranked, so it carries
 * `_compatibility` and `_aiRationale`) and `listOpportunities` (the plain
 * catalogue). The score fields are therefore optional — the card must render a
 * row that never went through the ranking.
 */
export type OpportunityWithScore = Row<"opportunities"> & {
  _compatibility?: number;
  _aiRationale?: string | null;
};

function Metric({ label, value }: { label: string; value: "low" | "medium" | "high" }) {
  const tone =
    value === "high"
      ? "text-success"
      : value === "medium"
        ? "text-primary"
        : "text-muted-foreground";
  const txt = value === "high" ? "Alto" : value === "medium" ? "Médio" : "Baixo";
  return (
    <div className="rounded-lg bg-background/40 p-2 text-center">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-xs font-semibold ${tone}`}>{txt}</div>
    </div>
  );
}

import { Brain } from "lucide-react";
import { MotionCard } from "@/components/app/Motion";
import { STATUS_META } from "../constants";

export function OpportunityCard({ o }: { o: OpportunityWithScore }) {
  // `actions` is a JSON column; narrowing once keeps the cast out of the JSX.
  const actions = readLabels(o.actions);
  const meta = STATUS_META[o.status];
  const Icon = meta.icon;
  return (
    <MotionCard className="section-card hover-lift group relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-2xl opacity-0 transition group-hover:opacity-100" />
      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full bg-background/60 px-2.5 py-0.5 text-xs ${meta.color}`}
          >
            <Icon className="size-3" /> {meta.label}
          </div>
          {typeof o._compatibility === "number" && (
            <div
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                o._compatibility >= 70
                  ? "border-success/40 bg-success/10 text-success"
                  : o._compatibility >= 50
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background/40 text-muted-foreground"
              }`}
              title="Compatibilidade com seu perfil"
            >
              <Brain className="size-3" /> {o._compatibility}% match
            </div>
          )}
        </div>
        {o.niche && (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {o.niche}
          </span>
        )}
        <h3 className="text-lg font-medium leading-snug">{o.title}</h3>
        {o.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{o.description}</p>
        )}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <Metric label="Dificuldade" value={o.difficulty} />
          <Metric label="Competição" value={o.competition} />
          <Metric label="Potencial" value={o.growth_potential} />
        </div>
        {actions.length > 0 && (
          <ul className="space-y-1 border-t border-border/60 pt-3">
            {actions.map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-1 rounded-full bg-primary" /> {a.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </MotionCard>
  );
}
