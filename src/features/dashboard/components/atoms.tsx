import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  AlertTriangle, ArrowUpRight, CheckCircle2, Lightbulb, TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { fadeUp, MotionCard } from "@/components/app/Motion";

export function RecIcon({ kind }: { kind: string }) {
  const map: Record<string, { icon: LucideIcon; color: string }> = {
    warning: { icon: AlertTriangle, color: "text-destructive" },
    insight: { icon: TrendingUp, color: "text-primary" },
    suggestion: { icon: Lightbulb, color: "text-accent" },
    next_action: { icon: CheckCircle2, color: "text-success" },
  };
  const m = map[kind] ?? map.insight;
  const I = m.icon;
  return (
    <div className={`grid size-10 shrink-0 place-items-center rounded-2xl bg-background/40 backdrop-blur-sm ring-1 ring-border/50 transition-all duration-300 group-hover:ring-primary/40 group-hover:bg-primary/10 ${m.color}`}>
      <I className="size-4.5" />
    </div>
  );
}

export function SeverityPill({ severity }: { severity: string }) {
  const tone =
    severity === "critical" || severity === "high" ? "bg-destructive/15 text-destructive"
    : severity === "medium" ? "bg-primary/15 text-primary"
    : "bg-secondary text-secondary-foreground";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${tone}`}>{severity}</span>;
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "done" ? "bg-success/15 text-success"
    : status === "in_progress" ? "bg-primary/15 text-primary"
    : status === "blocked" ? "bg-destructive/15 text-destructive"
    : "bg-secondary text-secondary-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${tone}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-card/20 px-4 py-6 text-center text-sm leading-relaxed text-muted-foreground">
      {text}
    </div>
  );
}

export function LinkAction({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="link-underline inline-flex items-center gap-1 text-xs text-primary">
      {label} <ArrowUpRight className="size-3" />
    </Link>
  );
}

export function Panel({
  title, icon: Icon, action, children, className = "",
}: {
  title: string; icon: LucideIcon; action?: ReactNode;
  children: ReactNode; className?: string;
}) {
  return (
    <motion.div variants={fadeUp} className={`section-card p-6 md:p-8 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-accent" />
          <span className="tracking-tight">{title}</span>
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

export function KpiCard({
  icon: Icon, label, value, hint, to,
}: { icon: LucideIcon; label: string; value: string | number; hint?: string; to?: string }) {
  const body = (
    <MotionCard className="stat-tile group relative block overflow-hidden p-6 md:p-7">
      <div className="flex items-center justify-between">
        <Icon className="size-4 text-accent transition-colors group-hover:text-primary" />
        {to && <ArrowUpRight className="size-3 text-muted-foreground transition group-hover:text-primary" />}
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums tracking-tighter text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}{hint ? ` · ${hint}` : ""}</div>
    </MotionCard>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}
