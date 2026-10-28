import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Trend = "up" | "down" | "flat";

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  trend?: Trend;
  delta?: string;
  /** Visually mark as the primary KPI */
  emphasis?: boolean;
  className?: string;
}

const trendStyles: Record<Trend, string> = {
  up: "text-success bg-success/10 border-success/20",
  down: "text-destructive bg-destructive/10 border-destructive/20",
  flat: "text-muted-foreground bg-muted/40 border-border",
};

const TrendIcon: Record<Trend, LucideIcon> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
};

/** Consistent KPI atom for dashboards. */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  delta,
  emphasis,
  className,
}: StatTileProps) {
  const Trender = trend ? TrendIcon[trend] : null;

  return (
    <div className={cn("stat-tile group", emphasis && "shadow-glow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <div className="grid size-8 place-items-center rounded-lg bg-secondary/60 text-foreground/70 transition-colors group-hover:text-primary">
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-tight tabular-nums text-foreground md:text-[28px]">
          {value}
        </div>
        {trend && Trender && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
              trendStyles[trend],
            )}
          >
            <Trender className="size-3" />
            {delta}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
