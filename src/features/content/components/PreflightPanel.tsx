import {
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ShieldAlert,
  Sparkles,
  Target,
} from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp } from "@/components/app/motion-presets";
import type { QualityIssue } from "@/lib/growth/post-quality";
import type { ChannelResult } from "../hooks/usePreflight";

interface PreflightPanelProps {
  result: { channels: ChannelResult[]; canPublish: boolean } | undefined;
  loading: boolean;
  onUseHook: (text: string) => void;
  hookSuggestions:
    Array<{ id: string; label: string; text: string; rationale: string }> | undefined;
  platformLabel: (p: string) => string;
}

const SEVERITY_META = {
  blocker: {
    icon: ShieldAlert,
    tone: "text-destructive",
    bg: "bg-destructive/10 border-destructive/30",
  },
  warning: {
    icon: AlertTriangle,
    tone: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/30",
  },
  tip: { icon: Lightbulb, tone: "text-sky-500", bg: "bg-sky-500/10 border-sky-500/30" },
} as const;

function IssueRow({ issue }: { issue: QualityIssue }) {
  const meta = SEVERITY_META[issue.severity];
  const Icon = meta.icon;
  return (
    <div className={`rounded-lg border px-3 py-2 ${meta.bg}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 size-3.5 shrink-0 ${meta.tone}`} />
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-snug text-foreground">{issue.title}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{issue.why}</p>
          {issue.fix && (
            <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">
              <span className="font-medium">Como corrigir: </span>
              {issue.fix}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ value, label }: { value: number; label: string }) {
  const tone =
    value >= 75 ? "text-emerald-500" : value >= 50 ? "text-amber-500" : "text-destructive";
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid size-12 place-items-center">
        <svg viewBox="0 0 36 36" className="absolute size-12 -rotate-90">
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            strokeWidth="3"
            className="stroke-secondary"
          />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className={`${tone} transition-all duration-500`}
            stroke="currentColor"
            strokeDasharray={`${(value / 100) * 97.4} 97.4`}
          />
        </svg>
        <span className={`text-xs font-bold tabular-nums ${tone}`}>{value}</span>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">
          {value >= 75
            ? "Pronto para publicar"
            : value >= 50
              ? "Publicável, com ajustes"
              : "Vai perder alcance"}
        </div>
      </div>
    </div>
  );
}

/**
 * Live preflight panel. This is VELT's answer to the 2026 market baseline
 * where every competitor ships a generic AI caption writer: here the product
 * audits the user's own text against hard platform limits and craft rules,
 * explains every finding, and can restructure the hook from the post's own
 * content — no LLM, deterministic and instant.
 */
export function PreflightPanel({
  result,
  loading,
  onUseHook,
  hookSuggestions,
  platformLabel,
}: PreflightPanelProps) {
  const primary = result?.channels[0];
  const issues = primary
    ? [...primary.blockers, ...primary.warnings, ...primary.tips].slice(0, 6)
    : [];

  return (
    <motion.aside variants={fadeUp} className="section-card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent" />
          <h3 className="text-sm font-semibold">Pré-voo do Brain</h3>
        </div>
        {primary && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            {platformLabel(primary.platform)}
          </span>
        )}
      </div>

      {loading && <p className="text-xs text-muted-foreground">Analisando…</p>}

      {!loading && !primary && (
        <p className="text-xs text-muted-foreground">
          Comece a escrever: cada frase é auditada contra os limites reais da plataforma e contra
          padrões de gancho que funcionam.
        </p>
      )}

      {!loading && primary && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ScoreRing value={primary.score} label="Qualidade" />
            <ScoreRing value={primary.ad.score} label="Pronto p/ anúncio" />
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="tabular-nums">{primary.stats.chars} car.</span>
            <span className="tabular-nums">
              {primary.stats.visibleChars} visíveis antes do “ver mais”
            </span>
            <span className="tabular-nums">{primary.stats.hashtags} hashtags</span>
            <span className="tabular-nums">{primary.stats.lines} parágrafos</span>
          </div>

          {primary.blockers.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-[11px] font-medium text-destructive">
              {primary.blockers.length} impedimento(s) — a publicação falharia na fila.
            </div>
          )}

          {primary.ad.verdict === "ready" && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
              <p className="text-[11px] leading-relaxed text-foreground/85">
                Este criativo também serve como anúncio: gancho, promessa e CTA estão no lugar.
                Reaproveite o mesmo texto no gerenciador de tráfego.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {issues.map((issue, i) => (
              <IssueRow key={`${issue.id}-${i}`} issue={issue} />
            ))}
          </div>

          {hookSuggestions && hookSuggestions.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <Target className="size-3 text-accent" /> Reescritas de gancho
              </div>
              {hookSuggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onUseHook(s.text)}
                  className="group w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-left transition hover:border-primary/50 hover:bg-secondary/40"
                >
                  <p className="text-xs font-medium leading-snug text-foreground group-hover:text-primary">
                    “{s.text}”
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {s.rationale}
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </motion.aside>
  );
}
