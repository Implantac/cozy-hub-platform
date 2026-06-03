import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, TrendingUp } from "lucide-react";
import { fadeUp } from "@/components/app/Motion";
import type { ScoredArea } from "../constants";

type Props = {
  area: ScoredArea;
  pending: boolean;
  onScore: (score: number) => void;
};

export function SkillCard({ area, pending, onScore }: Props) {
  const [draft, setDraft] = useState<number>(area.score ?? 0);
  const score = area.score ?? draft;
  const status = score >= 80 ? "mastered" : score >= 30 ? "learning" : "todo";
  const Icon = status === "mastered" ? CheckCircle2 : status === "learning" ? TrendingUp : Circle;
  const tone =
    status === "mastered" ? "border-success/30 bg-success/5"
    : status === "learning" ? "border-primary/30 bg-primary/5"
    : "border-border bg-card/60";

  return (
    <motion.div variants={fadeUp} className={`section-card hover-lift p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 size-4 ${
          status === "mastered" ? "text-success" : status === "learning" ? "text-primary" : "text-muted-foreground"
        }`} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{area.label}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{area.why}</p>
        </div>
        <span className="text-xs font-mono tabular-nums text-muted-foreground">{score}</span>
      </div>
      <input
        type="range" min={0} max={100} step={5}
        value={draft || (area.score ?? 0)}
        onChange={(e) => setDraft(Number(e.target.value))}
        onMouseUp={(e) => onScore(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => onScore(Number((e.target as HTMLInputElement).value))}
        disabled={pending}
        className="mt-3 w-full accent-primary"
      />
    </motion.div>
  );
}
