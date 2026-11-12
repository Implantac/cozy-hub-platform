import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AnalyticsSyncService } from "@/lib/services";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { collectionAge } from "@/lib/analytics/readiness";
import type { SyncSummary } from "@/lib/analytics/sync.server";
import { PLATFORM_RULES, type PlatformId } from "@/lib/growth/platform-rules";
import { QueryErrorState } from "@/features/shell/components/QueryErrorState";

export function SyncMetricsPanel() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const getReadiness = useServerFn(AnalyticsSyncService.getMetricsReadiness);
  const runSync = useServerFn(AnalyticsSyncService.syncWorkspaceMetrics);
  const [running, setRunning] = useState(false);
  const lock = useRef(false);
  const [last, setLast] = useState<SyncSummary | null>(null);
  const q = useWorkspaceQuery(
    (workspaceId) => ["metrics-readiness", workspaceId],
    ({ workspaceId }) => getReadiness({ data: { workspaceId } }),
    { staleTime: 60_000, retry: false },
  );
  const data = q.data;
  const canSync = !!data?.canSync && data.measurableChannels > 0;
  const help = !data
    ? t("common.loading")
    : !data.canSync
      ? t("analytics.ownerRequired")
      : !data.measurableChannels
        ? t("analytics.connectToMeasure")
        : t("analytics.syncHelp");

  const onSync = async () => {
    if (!q.wsId || !canSync || q.isError || q.isFetching || lock.current) return;
    lock.current = true;
    setRunning(true);
    try {
      const result = await runSync({ data: { workspaceId: q.wsId, lookbackDays: 30 } });
      setLast(result);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["analytics", q.wsId] }),
        qc.invalidateQueries({ queryKey: ["metrics-readiness", q.wsId] }),
        qc.invalidateQueries({ queryKey: ["best-time", q.wsId] }),
      ]);
      if (result.snapshotsWritten > 0) {
        toast.success(
          t("analytics.syncSuccess", {
            posts: result.postsMeasured,
            records: result.snapshotsWritten,
          }),
        );
      } else if (result.errors.length > 0) {
        toast.error(t("analytics.syncError", { count: result.errors.length }));
      } else {
        toast.message(t("analytics.noNewCollection"));
      }
    } catch {
      toast.error(t("analytics.syncFailed"));
    } finally {
      lock.current = false;
      setRunning(false);
    }
  };

  if (q.isError) {
    return (
      <QueryErrorState
        title={t("analytics.readinessError")}
        onRetry={() => void q.refetch()}
        pending={q.isFetching}
      />
    );
  }

  return (
    <section
      className="section-card space-y-3 p-4"
      aria-labelledby="metrics-sync-heading"
      aria-busy={q.isFetching || running}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <RefreshCw
            aria-hidden="true"
            className={`size-4 text-accent ${running ? "animate-spin" : ""}`}
          />
          <h2 id="metrics-sync-heading" className="text-sm font-semibold">
            {t("analytics.collectionTitle")}
          </h2>
          {data && (
            <span className="text-xs text-muted-foreground">
              {t("analytics.collectionCounts", {
                snapshots: data.snapshots,
                posts: data.publishedPosts,
              })}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void onSync()}
          disabled={running || q.isFetching || !canSync}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          aria-describedby="metrics-sync-help"
        >
          <RefreshCw aria-hidden="true" className={`size-3.5 ${running ? "animate-spin" : ""}`} />
          {t(running ? "analytics.collecting" : "analytics.measureNow")}
        </button>
      </div>
      <p id="metrics-sync-help" className="text-xs text-muted-foreground">
        {help}
      </p>

      {data?.reasonCode && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground" />
          <div>
            <p className="text-sm leading-relaxed">{t(`analytics.reason_${data.reasonCode}`)}</p>
            {data.connectedChannels === 0 && (
              <Link
                to="/app/channels"
                className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("analytics.manageChannels")} →
              </Link>
            )}
          </div>
        </div>
      )}
      {data && data.channels.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          {data.channels.map((channel) => {
            const age = collectionAge(channel.lastSyncedAt);
            return (
              <li
                key={channel.id}
                className="inline-flex flex-wrap items-center gap-1.5 text-muted-foreground"
              >
                {channel.status === "connected" && channel.insightCapable ? (
                  <CheckCircle2 aria-hidden="true" className="size-3.5 text-foreground" />
                ) : (
                  <AlertCircle aria-hidden="true" className="size-3.5" />
                )}
                <span>
                  {PLATFORM_RULES[channel.platform as PlatformId]?.label ?? channel.platform}
                </span>
                <span>
                  ·{" "}
                  {t(
                    !channel.insightCapable
                      ? "analytics.unsupportedChannel"
                      : channel.status !== "connected"
                        ? "analytics.oauthRequired"
                        : "analytics.lastCollection",
                  )}
                </span>
                <span>
                  · {t(`analytics.age_${age.key}`, "count" in age ? { count: age.count } : {})}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {last && (
        <p role="status" className="text-xs text-muted-foreground">
          {t("analytics.lastRun", { posts: last.postsMeasured, records: last.snapshotsWritten })}
        </p>
      )}
      {last && last.errors.length > 0 && (
        <div
          role="alert"
          className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
        >
          {last.errors.slice(0, 3).map((error, index) => (
            <p key={index} className="break-words text-xs leading-relaxed text-destructive">
              {PLATFORM_RULES[error.platform as PlatformId]?.label ?? error.platform}: {error.error}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
