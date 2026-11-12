import { useTranslation } from "react-i18next";
import { Ban, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { enUS } from "date-fns/locale/en-US";
import type { SchedulerJob } from "@/lib/api/_types";
import { STATUS_META, type JobStatus } from "../constants";

type Props = {
  jobs: SchedulerJob[];
  onCancel: (jobId: string) => void;
  cancelPending: boolean;
};

export function SchedulerTable({ jobs, onCancel, cancelPending }: Props) {
  const { t, i18n } = useTranslation();
  return (
    <div className="section-card overflow-x-auto p-0">
      <table className="w-full min-w-[650px] text-sm">
        <thead className="border-b border-border bg-background/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">{t("scheduler.content")}</th>
            <th className="px-4 py-3 font-medium">{t("scheduler.channel")}</th>
            <th className="px-4 py-3 font-medium">{t("scheduler.scheduledAt")}</th>
            <th className="px-4 py-3 font-medium">{t("scheduler.status")}</th>
            <th className="px-4 py-3 font-medium">{t("scheduler.attempts")}</th>
            <th className="px-4 py-3 text-right font-medium">{t("scheduler.actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {jobs.map((j) => {
            const meta = STATUS_META[j.status as JobStatus];
            const Icon = meta?.icon ?? Clock;
            return (
              <tr key={j.id} className="transition-colors hover:bg-background/40">
                <td className="px-4 py-3">
                  <div className="font-medium">{j.content?.title || t("scheduler.untitled")}</div>
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
                    ? formatDistanceToNow(new Date(j.scheduled_at), {
                        addSuffix: true,
                        locale: i18n.language === "en-US" ? enUS : ptBR,
                      })
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${meta?.className ?? ""}`}
                  >
                    <Icon className={`size-3 ${j.status === "processing" ? "animate-spin" : ""}`} />
                    {t(`scheduler.${j.status}`, { defaultValue: j.status })}
                  </span>
                  {j.last_error ? (
                    <div className="mt-1 truncate text-xs text-destructive" title={j.last_error}>
                      {j.last_error}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{j.attempts ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  {j.status === "pending" ? (
                    <button
                      onClick={() => onCancel(j.id)}
                      disabled={cancelPending}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50"
                    >
                      <Ban aria-hidden="true" className="size-3" /> {t("scheduler.cancel")}
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
