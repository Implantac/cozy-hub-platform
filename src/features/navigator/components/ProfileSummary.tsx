import { motion } from "framer-motion";
import { ChevronRight, Sparkles } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { stagger } from "@/components/app/Motion";
import { BUSINESS_PATHS } from "../constants";
import { NavigatorHeader, Stat } from "./atoms";

export function ProfileSummary({ profile, onRetake }: { profile: any; onRetake: () => void }) {
  const navigate = useNavigate();
  const p = profile;
  return (
    <div className="space-y-6">
      <NavigatorHeader />
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="grid gap-4 md:grid-cols-3"
      >
        <Stat
          label="Nível"
          value={
            p.experience_level === "beginner"
              ? "Iniciante"
              : p.experience_level === "intermediate"
                ? "Intermediário"
                : "Avançado"
          }
        />
        <Stat
          label="Caminho"
          value={BUSINESS_PATHS.find((b) => b.id === p.business_path)?.label ?? "—"}
        />
        <Stat label="Maturidade" value={String(p.maturity_level).toUpperCase()} />
      </motion.div>

      <div className="section-card p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-accent" /> Suas próximas ações
        </div>
        <ul className="space-y-2">
          {((p.recommended_actions as Array<{ title: string; href?: string }> | null) ?? []).map(
            (a, i) => (
              <li
                key={i}
                className="hover-lift flex items-center justify-between rounded-xl border border-border bg-background/40 p-4 transition hover:border-primary/40"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-8 place-items-center rounded-lg bg-primary/15 text-sm font-semibold text-primary">
                    {i + 1}
                  </div>
                  <span className="text-sm font-medium">{a.title}</span>
                </div>
                {a.href && (
                  <button
                    onClick={() => navigate({ to: a.href! })}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                  >
                    Ir <ChevronRight className="size-3" />
                  </button>
                )}
              </li>
            ),
          )}
        </ul>
      </div>

      <button onClick={onRetake} className="text-sm text-primary hover:underline">
        Refazer diagnóstico →
      </button>
    </div>
  );
}
