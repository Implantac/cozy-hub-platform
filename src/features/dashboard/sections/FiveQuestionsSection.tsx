import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Flag,
  GitBranch,
  MapPin,
  Rocket,
  Shield,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { fadeUp, stagger } from "@/components/app/motion-presets";
type FiveQ = {
  question: string;
  headline?: string | null;
  body?: string | null;
  cta?: { href: string; label: string } | null;
  confidence?: number | null;
  aiNote?: string | null;
  source?: "rules" | "ai";
};

const CARDS: { q: string; icon: LucideIcon; label: string }[] = [
  { q: "where_am_i", icon: MapPin, label: "Onde estou?" },
  { q: "where_to_go", icon: Flag, label: "Onde quero chegar?" },
  { q: "whats_blocking", icon: Shield, label: "O que me impede?" },
  { q: "next_action", icon: Rocket, label: "Próxima ação" },
  { q: "should_pivot", icon: GitBranch, label: "Devo mudar?" },
];

export function FiveQuestionsSection({ answers, loading }: { answers: FiveQ[]; loading: boolean }) {
  return (
    <motion.section variants={stagger} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {CARDS.map((card) => {
        const a = answers.find((x) => x.question === card.q);
        const Icon = card.icon;
        return (
          <motion.div
            key={card.q}
            variants={fadeUp}
            className="section-card hover-lift group relative overflow-hidden p-5 transition-all duration-300 hover:border-primary/50 hover:bg-card/80"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <Icon className="size-3 text-accent" /> {card.label}
            </div>
            <div className="mt-3 text-base font-bold leading-tight text-balance transition-colors group-hover:text-primary">
              {a?.headline ?? (loading ? "Analisando..." : "—")}
            </div>
            {a?.body && (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {a.body}
              </p>
            )}
            {a?.aiNote && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-accent/30 bg-accent/5 px-2 py-1.5">
                <Sparkles className="mt-0.5 size-3 shrink-0 text-accent" />
                <p className="text-[11px] leading-snug text-foreground/85 line-clamp-3">
                  {a.aiNote}
                </p>
              </div>
            )}
            {a?.cta && (
              <Link
                to={a.cta.href}
                className="link-underline mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary"
              >
                {a.cta.label} <ArrowUpRight className="size-3" />
              </Link>
            )}
            {typeof a?.confidence === "number" && (
              <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-brand"
                  style={{ width: `${Math.round(a.confidence * 100)}%` }}
                />
              </div>
            )}
          </motion.div>
        );
      })}
    </motion.section>
  );
}
