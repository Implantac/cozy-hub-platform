import { motion } from "framer-motion";
import { MapPin, Sparkles } from "lucide-react";
import { fadeUp } from "@/components/app/Motion";
import type { Mentor, Period } from "../types";
import { Metric } from "./atoms";

type Props = { mentor: Mentor; current?: Period };

export function MentorPanel({ mentor, current }: Props) {
  return (
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
  );
}
