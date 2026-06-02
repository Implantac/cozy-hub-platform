import { AlertTriangle, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  className?: string;
}

function stringifyError(err: unknown): string | null {
  if (!err) return null;
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return null;
  }
}

/** Unified error surface for route `errorComponent`s and inline failures. */
export function ErrorState({
  title = "Algo deu errado",
  description = "Não conseguimos carregar esta seção. Tente novamente em instantes.",
  error,
  onRetry,
  retryLabel = "Tentar novamente",
  action,
  className,
}: ErrorStateProps) {
  const detail = stringifyError(error);

  return (
    <div
      role="alert"
      className={cn(
        "section-card animate-rise-in flex flex-col items-center justify-center gap-4 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {detail && (
        <pre className="max-w-md overflow-x-auto rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-[11px] leading-relaxed text-muted-foreground">
          {detail}
        </pre>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {onRetry && (
          <Button size="sm" onClick={onRetry} className="gap-1.5">
            <RotateCw className="size-3.5" />
            {retryLabel}
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
