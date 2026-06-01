import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
  Ban,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PageTransition } from "@/components/app/Motion";
import {
  useWorkspaceMutation,
  useWorkspaceQuery,
} from "@/lib/query/use-workspace-query";
import {
  cancelSchedulerJob,
  listSchedulerJobs,
  runSchedulerTickManual,
} from "@/lib/api/scheduler.functions";
import type { SchedulerJob } from "@/lib/api/_types";

export const Route = createFileRoute("/_authenticated/app/scheduler")({
  component: SchedulerPage,
});

type JobStatus = "pending" | "processing" | "succeeded" | "failed" | "dead_letter";
const STATUSES: readonly (JobStatus | "all")[] = [
  "all",
  "pending",
  "processing",
  "succeeded",
  "failed",
  "dead_letter",
] as const;

const STATUS_META: Record<
  JobStatus,
  { icon: typeof Clock; className: string; label: string }
> = {
  pending: { icon: Clock, className: "bg-secondary text-secondary-foreground", label: "Pending" },
  processing: { icon: Loader2, className: "bg-primary/15 text-primary", label: "Processing" },
  succeeded: { icon: CheckCircle2, className: "bg-success/20 text-success", label: "Succeeded" },
  failed: { icon: XCircle, className: "bg-destructive/15 text-destructive", label: "Failed" },
  dead_letter: { icon: AlertTriangle, className: "bg-warning/20 text-warning", label: "Dead letter" },
};

function SchedulerPage() {
  const list = useServerFn(listSchedulerJobs);
  const cancel = useServerFn(cancelSchedulerJob);
  const tick = useServerFn(runSchedulerTickManual);

  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("all");

  const q = useWorkspaceQuery<SchedulerJob[]>(
    (wsId) => ["scheduler", wsId, filter],
    ({ workspaceId }) =>
      list({
        data: {
          workspaceId,
          status: filter === "all" ? undefined : filter,
          limit: 100,
        },
      }) as Promise<SchedulerJob[]>,
  );
  const invalidateKey = q.wsId ? ["scheduler", q.wsId, filter] : ["scheduler"];

  const cancelMut = useWorkspaceMutation(
    (jobId: string) => cancel({ data: { workspaceId: q.wsId!, jobId } }),
    { invalidate: invalidateKey, successMessage: "Job canceled" },
  );

  const tickMut = useWorkspaceMutation(
    () => tick({ data: { limit: 10 } }),
    {
      invalidate: invalidateKey,
      successMessage: (r) => `Dispatcher ran · ${(r as { processed?: number }).processed ?? 0} processed`,
    },
  );

  const counts = (q.data ?? []).reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={Calendar}
          title="Scheduler"
          subtitle="Multi-channel publishing queue with retry & DLQ."
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((s) => {
              const active = s === filter;
              const label = s === "all" ? "All" : STATUS_META[s].label;
              const count = s === "all" ? q.data?.length ?? 0 : counts[s] ?? 0;
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                  <span className="rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => tickMut.mutate()}
            disabled={!q.wsId || tickMut.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Play className="size-3.5" />
            {tickMut.isPending ? "Dispatching..." : "Run dispatcher"}
          </button>
        </div>

        {q.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-card/40" />
            ))}
          </div>
        ) : q.data?.length === 0 ? (
          <EmptyState text="No scheduled jobs. Publish content from the Content module to enqueue." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-background/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Content</th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Scheduled</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Attempts</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(q.data ?? []).map((j) => {
                  const meta = STATUS_META[j.status as JobStatus];
                  const Icon = meta?.icon ?? Clock;
                  return (
                    <tr key={j.id} className="hover:bg-background/40">
                      <td className="px-4 py-3">
                        <div className="font-medium">{j.content?.title || "Untitled"}</div>
                        <div className="text-xs text-muted-foreground">{j.content?.type ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">
                        {j.channel?.platform ?? "—"}
                        {j.channel?.name ? (
                          <span className="ml-1 text-xs">· {j.channel.name}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {j.scheduled_at
                          ? formatDistanceToNow(new Date(j.scheduled_at), { addSuffix: true })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${meta?.className ?? ""}`}
                        >
                          <Icon
                            className={`size-3 ${j.status === "processing" ? "animate-spin" : ""}`}
                          />
                          {meta?.label ?? j.status}
                        </span>
                        {j.last_error ? (
                          <div className="mt-1 truncate text-xs text-destructive" title={j.last_error}>
                            {j.last_error}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {j.attempts ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {j.status === "pending" ? (
                          <button
                            onClick={() => cancelMut.mutate(j.id)}
                            disabled={cancelMut.isPending}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50"
                          >
                            <Ban className="size-3" /> Cancel
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
