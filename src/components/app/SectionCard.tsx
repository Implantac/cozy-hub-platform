import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  /** Reduce padding for dense layouts */
  dense?: boolean;
  /** Render without padding (caller controls inner spacing) */
  flush?: boolean;
  children?: ReactNode;
}

/**
 * Unified surface for grouped content. Replaces ad-hoc
 * `rounded-2xl border bg-card/60 backdrop-blur` patterns.
 */
export function SectionCard({
  title,
  description,
  eyebrow,
  icon: Icon,
  action,
  dense,
  flush,
  className,
  children,
  ...rest
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || eyebrow || action || Icon);
  const pad = flush ? "" : dense ? "p-4 md:p-5" : "p-5 md:p-6";

  return (
    <section
      {...rest}
      className={cn("section-card animate-rise-in", pad, className)}
    >
      {hasHeader && (
        <header className={cn("flex flex-wrap items-start justify-between gap-3", children ? "mb-4" : "")}>
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary/60 text-foreground/80">
                <Icon className="size-4" />
              </div>
            )}
            <div className="min-w-0">
              {eyebrow && <div className="eyebrow-chip mb-1.5">{eyebrow}</div>}
              {title && <h2 className="section-title text-foreground">{title}</h2>}
              {description && (
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
