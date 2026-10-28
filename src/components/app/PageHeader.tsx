import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
  /** Optional pre-title content, e.g. breadcrumbs */
  breadcrumb?: ReactNode;
  className?: string;
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  eyebrow,
  action,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn("flex flex-wrap items-end justify-between gap-4 animate-rise-in", className)}
    >
      <div className="flex min-w-0 items-start gap-3 sm:gap-3.5">
        <div className="relative grid size-9 sm:size-11 shrink-0 place-items-center rounded-xl bg-gradient-brand shadow-glow">
          <Icon className="size-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          {breadcrumb && <div className="mb-1 text-xs text-muted-foreground">{breadcrumb}</div>}
          {eyebrow && <div className="eyebrow-chip mb-1.5">{eyebrow}</div>}
          <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight sm:text-[26px] md:text-[30px] text-foreground">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1.5 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}
