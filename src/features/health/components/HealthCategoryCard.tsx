import { motion } from "framer-motion";
import { Check, AlertTriangle } from "lucide-react";
import { fadeUp } from "@/components/app/Motion";
import { CAT_META } from "../constants";
import type { Row } from "@/lib/brain/types";

export function HealthCategoryCard({ h }: { h: Row<"health_metrics"> }) {
  const meta = CAT_META[h.category];
  const Icon = meta.icon;
  const tone = h.score >= 70 ? "text-success" : h.score >= 40 ? "text-primary" : "text-destructive";
  return (
    <motion.div variants={fadeUp} className="section-card hover-lift p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-accent" /> {meta.label}
        </div>
        <div className={`text-2xl font-semibold tabular-nums tracking-tight ${tone}`}>
          {h.score}
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${h.score}%` }}
          transition={{ duration: 0.8 }}
          className="h-full rounded-full bg-gradient-brand"
        />
      </div>
      {(h.strengths?.length ?? 0) > 0 && (
        <ul className="mt-4 space-y-1.5">
          {h.strengths.map((s: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-success">
              <Check className="size-3 mt-0.5 shrink-0" /> <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
      {(h.weaknesses?.length ?? 0) > 0 && (
        <ul className="mt-2 space-y-1.5">
          {h.weaknesses.map((s: string, i: number) => (
            <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-destructive">
              <AlertTriangle className="size-3 mt-0.5 shrink-0" /> <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
