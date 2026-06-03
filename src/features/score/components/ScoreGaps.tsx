import { motion } from "framer-motion";
import { fadeUp } from "@/components/app/Motion";

export function ScoreGaps({ gaps }: { gaps: string[] }) {
  if (!gaps?.length) return null;
  return (
    <motion.div variants={fadeUp} className="section-card p-5 md:p-6">
      <div className="mb-3 text-sm font-medium tracking-tight">Como subir cada pilar</div>
      <ul className="space-y-2">
        {gaps.map((g, i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/40 p-3 text-sm leading-relaxed">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i + 1}</span>
            {g}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
