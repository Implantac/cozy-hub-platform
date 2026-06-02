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
  text, title, icon: Icon, action, secondaryAction, helpHref, helpLabel,
  variant = "default", className,
}: EmptyStateProps) {
  if (variant === "default" && !Icon && !title && !action && !secondaryAction) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{text}</p>;
  }

  const wrapper = variant === "card"
    ? "rounded-2xl border border-border bg-card/40 backdrop-blur"
    : "rounded-xl border border-dashed border-border/80 bg-card/20";

  return (
    <div className={cn(wrapper, "flex flex-col items-center justify-center gap-3 px-6 py-10 text-center", className)}>
      {Icon && (
        <div className="grid size-11 place-items-center rounded-xl bg-secondary/60 text-muted-foreground">
          <Icon className="size-5" />
        </div>
      )}
      {title && <p className="text-sm font-medium text-foreground">{title}</p>}
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {action}
          {secondaryAction}
        </div>
      )}
      {helpHref && (
        <a
          href={helpHref}
          target={helpHref.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {helpLabel ?? "Saiba mais"}
        </a>
      )}
    </div>
  );
}
