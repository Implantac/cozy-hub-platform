import { motion } from "framer-motion";
import { Minus, TrendingUp } from "lucide-react";
import { fadeUp, stagger } from "@/components/app/Motion";
import type { Period } from "../types";
import { Mini } from "./atoms";

function PeriodRow({ period: p }: { period: Period }) {
  const TIcon = p.score_avg == null ? Minus : p.events_count > 0 ? TrendingUp : Minus;
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

export function PeriodsTimeline({ periods }: { periods: Period[] }) {
  return (
    <motion.section variants={stagger} className="relative">
      <div className="absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-border via-border to-transparent" />
      <div className="space-y-4">
        {periods.map((p) => <PeriodRow key={p.key} period={p} />)}
      </div>
    </motion.section>
  );
}
