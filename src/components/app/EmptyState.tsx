import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  text: string;
  title?: string;
  icon?: LucideIcon;
  /** Primary call-to-action (e.g. a Button). */
  action?: ReactNode;
  /** Secondary, lower-emphasis action shown next to `action`. */
  secondaryAction?: ReactNode;
  /** Optional link to documentation / learn more. */
  helpHref?: string;
  helpLabel?: string;
  variant?: "default" | "dashed" | "card";
  className?: string;
}

/**
 * Friendlier empty states with optional icon, title, action and help link.
 * Backward compatible: `<EmptyState text="..." />` keeps working.
 */
export function EmptyState({
  text,
  title,
  icon: Icon,
  action,
  secondaryAction,
  helpHref,
  helpLabel,
  variant = "default",
  className,
}: EmptyStateProps) {
  if (variant === "default" && !Icon && !title && !action && !secondaryAction) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{text}</p>;
  }

  const wrapper =
    variant === "card"
      ? "section-card"
      : "rounded-xl border border-dashed border-border/70 bg-card/20";

  return (
    <div
      className={cn(
        wrapper,
        "animate-rise-in flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-secondary/80 to-secondary/30 text-foreground/70 ring-1 ring-inset ring-border/60">
          <Icon className="size-6" />
        </div>
      )}
      {title && <p className="text-base font-semibold tracking-tight text-foreground">{title}</p>}
      <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">{text}</p>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {action}
          {secondaryAction}
        </div>
      )}
      {helpHref && (
        <a
          href={helpHref}
          target={helpHref.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          className="link-underline text-xs text-muted-foreground hover:text-foreground"
        >
          {helpLabel ?? "Saiba mais"}
        </a>
      )}
    </div>
  );
}
