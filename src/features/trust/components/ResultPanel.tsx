import { trustVerdictTone } from "../lib/verdict";
import type { ResultSection } from "../types";
import { BulletList } from "./BulletList";
import { ScoreBar } from "./ScoreBar";

interface ResultPanelProps {
  risk_score: number;
  verdict: string;
  summary: string;
  recommendation?: string;
  sections: ResultSection[];
  extraScores?: Array<{ label: string; value: number }>;
}

export function ResultPanel({
  risk_score,
  verdict,
  summary,
  recommendation,
  sections,
  extraScores,
}: ResultPanelProps) {
  const tone = trustVerdictTone(verdict);
  return (
    <div className="space-y-5">
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${tone.bg}`}>
        <tone.Icon className={`size-7 ${tone.color}`} />
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Veredito</div>
          <div className={`text-lg font-bold ${tone.color}`}>{tone.label}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Risco</div>
          <div className="font-mono text-2xl font-bold">{risk_score}</div>
        </div>
      </div>

      {summary && <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>}

      {extraScores && (
        <div className="grid grid-cols-2 gap-4">
          {extraScores.map((s) => (
            <ScoreBar key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      )}

      {recommendation && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
            Recomendação
          </div>
          {recommendation}
        </div>
      )}

      <div className="space-y-4">
        {sections.map((s) => (
          <BulletList key={s.title} {...s} />
        ))}
      </div>
    </div>
  );
}
