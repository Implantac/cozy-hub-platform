import { motion } from "framer-motion";
import { fadeUp } from "@/components/app/motion-presets";
import type { Competitor } from "../types";

export function ThreatMatrix({ items }: { items: Competitor[] }) {
  const maxF = Math.max(1, ...items.map((i) => i.followers));
  const maxE = Math.max(1, ...items.map((i) => i.engagement));
  return (
    <motion.div variants={fadeUp} className="section-card relative h-[420px] p-6">
      <div className="absolute left-3 top-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        ↑ Engajamento
      </div>
      <div className="absolute bottom-3 right-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        Audiência →
      </div>
      <div className="absolute inset-12">
        <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
        <div className="absolute inset-y-0 left-0 w-px bg-border" />
        {items.map((c) => {
          const x = (c.followers / maxF) * 100;
          const y = (c.engagement / maxE) * 100;
          const size = c.threat === "high" ? 56 : c.threat === "medium" ? 40 : 28;
          const tone =
            c.threat === "high"
              ? "bg-destructive/30 ring-destructive/60"
              : c.threat === "medium"
                ? "bg-warning/30 ring-warning/60"
                : "bg-muted ring-border";
          return (
            <div
              key={c.id}
              className={`absolute -translate-x-1/2 translate-y-1/2 rounded-full ring-2 transition hover:scale-110 ${tone}`}
              style={{ left: `${x}%`, bottom: `${y}%`, width: size, height: size }}
              title={c.name}
            >
              <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium">
                {c.name}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
