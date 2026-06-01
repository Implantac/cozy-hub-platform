import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ icon: Icon, title, subtitle, eyebrow, action, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-brand shadow-glow">
          <Icon className="size-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
              {eyebrow}
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight md:text-[28px] md:leading-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}
