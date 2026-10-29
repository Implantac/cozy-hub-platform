import { motion } from "framer-motion";
import { fadeUp } from "@/components/app/Motion";
import { ScoreGauge } from "@/components/app/ScoreGauge";
import type { Row } from "@/lib/brain/types";
import { PILLARS } from "../constants";

export function ScoreOverview({ score }: { score: Row<"digital_scores"> | null | undefined }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[auto,1fr]">
      <motion.div variants={fadeUp} className="section-card grid place-items-center p-8">
        <ScoreGauge value={score?.overall ?? 0} size={240} />
      </motion.div>
      <motion.div variants={fadeUp} className="grid gap-3 sm:grid-cols-2">
        {PILLARS.map((p) => {
          const v = (score?.[p.key] as number) ?? 0;
          return (
            <div key={p.key} className="stat-tile">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{p.label}</span>
                <span className="font-mono font-semibold tabular-nums">{v}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${v}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-gradient-brand"
                />
              </div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
