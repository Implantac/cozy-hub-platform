import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowUpRight, Flame, Heart } from "lucide-react";
import { fadeUp } from "@/components/app/Motion";
import { ScoreGauge } from "@/components/app/ScoreGauge";
import { Empty } from "../components/atoms";

type Props = {
  scoreOverall: number;
  healthAvg: number | null;
  health: any[];
  trending: any[];
};

export function TopRowSection({ scoreOverall, healthAvg, health, trending }: Props) {
  return (
    <section className="grid gap-4 lg:grid-cols-[auto,1fr,1fr]">
      <motion.div
        variants={fadeUp}
        className="section-card hover-lift group grid place-items-center p-6 sm:p-8 bg-gradient-to-br from-card/90 to-card/50"
      >
        <div className="relative">
          <div className="absolute inset-0 -m-4 rounded-full bg-primary/5 blur-3xl transition-opacity group-hover:opacity-100 opacity-0" />
          <ScoreGauge value={scoreOverall} size={200} label="Digital Score" />
        </div>
        <Link
          to="/app/score"
          className="link-underline mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-all hover:gap-2"
        >
          Ver detalhes <ArrowUpRight className="size-3.5" />
        </Link>
      </motion.div>

      <motion.div variants={fadeUp} className="section-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Heart className="size-4 text-accent" /> Saúde do negócio
          </div>
          <Link
            to="/app/health"
            className="link-underline text-xs text-primary inline-flex items-center gap-1"
          >
            Diagnóstico <ArrowUpRight className="size-3" />
          </Link>
        </div>
        {healthAvg === null ? (
          <Empty text="Calcule sua saúde no módulo Health." />
        ) : (
          <>
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-bold tabular-nums tracking-tighter text-foreground">
                {healthAvg}
              </span>
              <span className="text-xs text-muted-foreground">/ 100 — média geral</span>
            </div>
            <div className="space-y-2.5">
              {health.map((h: any) => (
                <div key={h.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="capitalize text-muted-foreground">{h.category}</span>
                    <span className="font-mono tabular-nums">{h.score}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-brand transition-all"
                      style={{ width: `${h.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>

      <motion.div variants={fadeUp} className="section-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Flame className="size-4 text-accent" /> Oportunidades em alta
          </div>
          <Link
            to="/app/opportunities"
            className="link-underline text-xs text-primary inline-flex items-center gap-1"
          >
            Explorar <ArrowUpRight className="size-3" />
          </Link>
        </div>
        {trending.length === 0 ? (
          <Empty text="Sem tendências capturadas ainda." />
        ) : (
          <ul className="space-y-2">
            {trending.map((o: any) => (
              <li
                key={o.id}
                className="rounded-lg border border-border/70 bg-background/40 p-3 transition hover:border-primary/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{o.title}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                      o.status === "exploding"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-primary/15 text-primary"
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
                {o.description && (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {o.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </section>
  );
}
