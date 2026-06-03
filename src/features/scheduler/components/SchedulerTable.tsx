import { Ban, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { SchedulerJob } from "@/lib/api/_types";
import { STATUS_META, type JobStatus } from "../constants";

type Props = {
  jobs: SchedulerJob[];
  onCancel: (jobId: string) => void;
  cancelPending: boolean;
};

export function SchedulerTable({ jobs, onCancel, cancelPending }: Props) {
  return (
    <div className="section-card overflow-hidden p-0">
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
          {jobs.map((j) => {
            const meta = STATUS_META[j.status as JobStatus];
            const Icon = meta?.icon ?? Clock;
            return (
              <tr key={j.id} className="transition-colors hover:bg-background/40">
                <td className="px-4 py-3">
                  <div className="font-medium">{j.content?.title || "Untitled"}</div>
                  <div className="text-xs text-muted-foreground">{j.content?.type ?? "—"}</div>
                </td>
                <td className="px-4 py-3 capitalize text-muted-foreground">
                  {j.channel?.platform ?? "—"}
                  {j.channel?.handle ? (
                    <span className="ml-1 text-xs">· {j.channel.handle}</span>
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
                      onClick={() => onCancel(j.id)}
                      disabled={cancelPending}
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
  );
}
