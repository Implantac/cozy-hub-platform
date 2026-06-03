import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

export type JobStatus = "pending" | "processing" | "succeeded" | "failed" | "dead_letter";

export const STATUSES: readonly (JobStatus | "all")[] = [
  "all",
  "pending",
  "processing",
  "succeeded",
  "failed",
  "dead_letter",
] as const;

export const STATUS_META: Record<
  JobStatus,
  { icon: typeof Clock; className: string; label: string }
> = {
  pending: { icon: Clock, className: "bg-secondary text-secondary-foreground", label: "Pending" },
  processing: { icon: Loader2, className: "bg-primary/15 text-primary", label: "Processing" },
  succeeded: { icon: CheckCircle2, className: "bg-success/20 text-success", label: "Succeeded" },
  failed: { icon: XCircle, className: "bg-destructive/15 text-destructive", label: "Failed" },
  dead_letter: { icon: AlertTriangle, className: "bg-warning/20 text-warning", label: "Dead letter" },
};
