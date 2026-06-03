import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowUpRight, Flag, GitBranch, MapPin, Rocket, Shield, Sparkles, type LucideIcon } from "lucide-react";
import { fadeUp, stagger } from "@/components/app/Motion";

type FiveQ = { question: string; headline?: string | null; body?: string | null; cta?: { href: string; label: string } | null; confidence?: number | null; aiNote?: string | null; source?: "rules" | "ai" };

const CARDS: { q: string; icon: LucideIcon; label: string }[] = [
  { q: "where_am_i", icon: MapPin, label: "Onde estou?" },
  { q: "where_to_go", icon: Flag, label: "Onde quero chegar?" },
  { q: "whats_blocking", icon: Shield, label: "O que me impede?" },
  { q: "next_action", icon: Rocket, label: "Próxima ação" },
  { q: "should_pivot", icon: GitBranch, label: "Devo mudar?" },
];

export function FiveQuestionsSection({
  answers, loading,
}: { answers: FiveQ[]; loading: boolean }) {
  return (
    <motion.section variants={stagger} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {CARDS.map((card) => {
        const a = answers.find((x) => x.question === card.q);
        const Icon = card.icon;
        return (
          <motion.div key={card.q} variants={fadeUp}
            className="section-card hover-lift relative overflow-hidden p-4 transition hover:border-primary/40">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <Icon className="size-3 text-accent" /> {card.label}
            </div>
            <div className="mt-2 text-sm font-semibold leading-snug text-balance">
              {a?.headline ?? (loading ? "Analisando..." : "—")}
            </div>
            {a?.body && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{a.body}</p>}
            {a?.cta && (
              <Link to={a.cta.href} className="link-underline mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                {a.cta.label} <ArrowUpRight className="size-3" />
              </Link>
            )}
            {typeof a?.confidence === "number" && (
              <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${Math.round(a.confidence * 100)}%` }} />
              </div>
            )}
          </motion.div>
        );
      })}
    </motion.section>
  );
}
