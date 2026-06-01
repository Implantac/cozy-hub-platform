import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  text: string;
  title?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  variant?: "default" | "dashed" | "card";
  className?: string;
}

/**
 * Friendlier empty states with optional icon, title and action.
 * Backward compatible: `<EmptyState text="..." />` keeps working.
 */
export function EmptyState({
  text, title, icon: Icon, action, variant = "default", className,
}: EmptyStateProps) {
  if (variant === "default" && !Icon && !title && !action) {
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
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
