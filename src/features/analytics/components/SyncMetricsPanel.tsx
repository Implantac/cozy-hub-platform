import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AnalyticsSyncService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { PLATFORM_RULES, type PlatformId } from "@/lib/growth/platform-rules";

interface Readiness {
  channels: Array<{
    platform: string;
    status: string;
    lastSyncedAt: string | null;
    insightCapable: boolean;
  }>;
  connectedChannels: number;
  measurableChannels: number;
  publishedPosts: number;
  snapshots: number;
  reason: string | null;
}

interface SyncSummary {
  channelsConsidered: number;
  channelsSynced: number;
  postsMeasured: number;
  snapshotsWritten: number;
  skipped: Array<{ platform: string; reason: string }>;
  errors: Array<{ platform: string; error: string }>;
  durationMs: number;
}

function relative(iso: string | null): string {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "há menos de 1h";
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

/**
 * Metric collection control.
 *
 * Two jobs: let the owner close the loop on demand, and explain the empty state.
 * A chart that says "sem dados" without saying *why* teaches the user that the
 * product is broken. This panel always states the reason and the next action.
 */
export function SyncMetricsPanel() {
  const [wsId] = useCurrentWorkspaceId();
  const qc = useQueryClient();
  const getReadiness = useServerFn(AnalyticsSyncService.getMetricsReadiness);
  const runSync = useServerFn(AnalyticsSyncService.syncWorkspaceMetrics);
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<SyncSummary | null>(null);

  const q = useQuery({
    queryKey: ["metrics-readiness", wsId],
    queryFn: async () => {
      const r = await getReadiness({ data: { workspaceId: wsId! } });
      return r as unknown as Readiness;
    },
    enabled: !!wsId,
    staleTime: 60_000,
    retry: false,
  });

  const data = q.data;

  const onSync = async () => {
    if (!wsId) return;
    setRunning(true);
    try {
      const r = (await runSync({
        data: { workspaceId: wsId, lookbackDays: 30 },
      })) as unknown as SyncSummary;
      setLast(r);
      await qc.invalidateQueries({ queryKey: ["analytics", wsId] });
      await qc.invalidateQueries({ queryKey: ["metrics-readiness", wsId] });
      await qc.invalidateQueries({ queryKey: ["best-time", wsId] });

      if (r.snapshotsWritten > 0) {
        toast.success(
          `${r.postsMeasured} posts medidos · ${r.snapshotsWritten} snapshots gravados`,
        );
      } else if (r.errors.length > 0) {
        toast.error(`Coleta falhou em ${r.errors.length} canal(is): ${r.errors[0].error}`);
      } else {
        toast.message("Nenhuma métrica nova — nada mudou desde a última coleta.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao sincronizar métricas");
    } finally {
      setRunning(false);
    }
  };

  if (q.isError) return null;

  return (
    <div className="section-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <RefreshCw className={`size-4 text-accent ${running ? "animate-spin" : ""}`} />
          <h3 className="text-sm font-semibold">Coleta de métricas</h3>
          {data && (
            <span className="text-[11px] text-muted-foreground">
              {data.snapshots} snapshot(s) · {data.publishedPosts} post(s) publicado(s)
            </span>
          )}
        </div>
        <button
          onClick={onSync}
          disabled={running || !data?.measurableChannels}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
          title={
            data?.measurableChannels
              ? "Buscar métricas agora nos canais conectados"
              : "Conecte um canal via OAuth para habilitar"
          }
        >
          <RefreshCw className={`size-3.5 ${running ? "animate-spin" : ""}`} />
          {running ? "Coletando…" : "Medir agora"}
        </button>
      </div>

      {data?.reason && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          <div>
            <p className="text-xs leading-relaxed text-foreground/85">{data.reason}</p>
            {data.connectedChannels === 0 && (
              <a
                href="/app/channels"
                className="mt-1 inline-block text-[11px] font-medium text-primary underline-offset-4 hover:underline"
              >
                Conectar um canal →
              </a>
            )}
          </div>
        </div>
      )}

      {data && data.channels.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
          {data.channels.map((c) => (
            <span
              key={c.platform}
              className="inline-flex items-center gap-1.5 text-muted-foreground"
              title={
                !c.insightCapable
                  ? "Esta plataforma exige um escopo adicional de leitura de métricas"
                  : c.status !== "connected"
                    ? "Canal não está conectado via OAuth"
                    : "Última coleta"
              }
            >
              {c.status === "connected" && c.insightCapable ? (
                <CheckCircle2 className="size-3 text-emerald-500" />
              ) : (
                <AlertCircle className="size-3 text-muted-foreground/60" />
              )}
              {PLATFORM_RULES[c.platform as PlatformId]?.label ?? c.platform}
              <span className="opacity-60">· {relative(c.lastSyncedAt)}</span>
            </span>
          ))}
        </div>
      )}

      {last && last.errors.length > 0 && (
        <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
          {last.errors.slice(0, 3).map((e, i) => (
            <p key={i} className="text-[11px] leading-relaxed text-destructive">
              {PLATFORM_RULES[e.platform as PlatformId]?.label ?? e.platform}: {e.error}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
