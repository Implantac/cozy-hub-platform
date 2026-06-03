import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListBlock, ScorePill } from "./atoms";

const VERDICT_MAP: Record<string, { label: string; tone: string }> = {
  strong: { label: "Forte", tone: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  promising: { label: "Promissora", tone: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  challenging: { label: "Desafiadora", tone: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  weak: { label: "Fraca", tone: "bg-red-500/15 text-red-600 border-red-500/30" },
};

export function ValidationCard({ v }: { v: any }) {
  const verdict = VERDICT_MAP[v.verdict] ?? VERDICT_MAP.challenging;

  return (
    <div className="section-card p-5 space-y-4 animate-rise-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium line-clamp-2">{v.idea}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(v.created_at).toLocaleString("pt-BR")} · {v.model_used}
          </p>
        </div>
        <Badge className={`shrink-0 border ${verdict.tone}`}>{verdict.label}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ScorePill label="Oportunidade" value={v.opportunity_score} />
        <ScorePill label="Demanda" value={v.market_demand_score} />
        <ScorePill label="Concorrência" value={v.competition_score} invert />
        <ScorePill label="Complexidade" value={v.complexity_score} invert />
      </div>

      {v.ai_analysis?.summary && (
        <p className="text-sm leading-relaxed border-l-2 border-primary/40 pl-3">{v.ai_analysis.summary}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ListBlock icon={CheckCircle2} title="Forças" tone="text-emerald-600" items={v.strengths ?? []} />
        <ListBlock icon={AlertCircle} title="Riscos" tone="text-amber-600" items={v.risks ?? []} />
      </div>

      {v.next_steps?.length > 0 && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight className="size-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide">Próximos passos</span>
          </div>
          <ol className="space-y-1.5 text-sm">
            {v.next_steps.map((s: string, i: number) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary font-semibold">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
