import { motion } from "framer-motion";
import { Brain, Compass } from "lucide-react";
import { fadeUp } from "@/components/app/motion-presets";
type Props = { onRefresh: () => void; isPending: boolean };

export function DashboardHeader({ onRefresh, isPending }: Props) {
  return (
    <motion.header variants={fadeUp} className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="eyebrow-chip mb-2">
          <Compass className="size-3 text-accent" />
          Business GPS · cockpit operacional
        </div>
        <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-[32px] md:text-[42px] text-foreground">
          USE Brain
        </h1>
        <p className="mt-1.5 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          O cérebro do seu negócio digital — sempre respondendo as 5 perguntas que importam.
        </p>
      </div>
      <button
        onClick={onRefresh}
        disabled={isPending}
        className="press group inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated disabled:opacity-60"
      >
        <Brain
          className={`size-4 transition group-hover:rotate-12 ${isPending ? "animate-pulse" : ""}`}
        />
        {isPending ? "Pensando..." : "Pensar de novo"}
      </button>
    </motion.header>
  );
}
