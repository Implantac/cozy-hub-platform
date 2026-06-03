import { motion } from "framer-motion";
import { Eye, Lightbulb, Minus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { fadeUp } from "@/components/app/Motion";
import { Block, Stat } from "./atoms";
import type { Competitor } from "../types";

export function CompetitorRow({ c, onRemove }: { c: Competitor; onRemove: () => void }) {
  const TIcon = c.trend === "up" ? TrendingUp : c.trend === "down" ? TrendingDown : Minus;
  const tTone = c.trend === "up" ? "text-success" : c.trend === "down" ? "text-destructive" : "text-muted-foreground";
  const threatTone =
    c.threat === "high" ? "bg-destructive/15 text-destructive"
    : c.threat === "medium" ? "bg-warning/15 text-warning"
    : "bg-secondary text-muted-foreground";

  return (
    <motion.div variants={fadeUp} className="section-card hover-lift p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{c.name}</span>
            {c.handle && <span className="text-xs text-muted-foreground">{c.handle}</span>}
          </div>
          {c.positioning && <p className="mt-1 text-xs text-muted-foreground">{c.positioning}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${threatTone}`}>
            ameaça {c.threat}
          </span>
          <button onClick={onRemove} className="grid size-8 place-items-center rounded-lg border border-border bg-background/40 text-muted-foreground transition hover:border-destructive/40 hover:text-destructive">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <Stat label="Seguidores" value={c.followers.toLocaleString("pt-BR")} />
        <Stat label="Engajamento" value={`${c.engagement}%`} />
        <Stat label="Tendência" value={
          <span className={`inline-flex items-center gap-1 ${tTone}`}>
            <TIcon className="size-3" /> {c.trend === "up" ? "Subindo" : c.trend === "down" ? "Caindo" : "Estável"}
          </span>
        } />
      </div>

      {(c.recent_move || c.gap) && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {c.recent_move && <Block icon={Eye} label="Movimento recente" body={c.recent_move} />}
          {c.gap && <Block icon={Lightbulb} label="Seu gap" body={c.gap} accent />}
        </div>
      )}
    </motion.div>
  );
}
