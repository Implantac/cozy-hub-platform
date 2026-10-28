import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, CalendarClock, Info, Sparkles } from "lucide-react";
import { GrowthService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { PLATFORM_RULES, type PlatformId } from "@/lib/growth/platform-rules";

interface BestTimeResult {
  platform: string;
  best: { at: string; label: string; confidence: "observed" | "baseline"; reason: string };
  topSlots: Array<{
    weekday: number;
    hourUtc: number;
    score: number;
    samples: number;
    confidence: "observed" | "baseline";
    reason: string;
  }>;
  usedFallback: boolean;
  observationsCount: number;
  cadence: { perWeek: number; rationale: string; source: string };
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function localHour(hourUtc: number): number {
  return (hourUtc - 3 + 24) % 24;
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Best time to post, per platform.
 *
 * Deliberately honest about provenance: when there is not enough of the user's
 * own history, the card says "janela padrão" instead of dressing a generic
 * recommendation up as personalised data. That distinction is the difference
 * between a tool people trust and one they learn to ignore.
 */
export function BestTimeCard({ platform = "instagram" }: { platform?: PlatformId }) {
  const [wsId] = useCurrentWorkspaceId();
  const fetchBest = useServerFn(GrowthService.getBestTimeToPost);

  const q = useQuery({
    queryKey: ["best-time", wsId, platform],
    queryFn: async () => {
      const r = await fetchBest({ data: { workspaceId: wsId!, platform } });
      return r as unknown as BestTimeResult;
    },
    enabled: !!wsId,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const data = q.data;
  const rules = PLATFORM_RULES[platform];

  return (
    <div className="section-card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-accent" />
          <h3 className="text-sm font-semibold">Melhor horário</h3>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            {rules?.label ?? platform}
          </span>
        </div>
        {data && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              data.best.confidence === "observed"
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-amber-500/10 text-amber-500"
            }`}
          >
            {data.best.confidence === "observed" ? (
              <>
                <BarChart3 className="size-2.5" /> Seus dados
              </>
            ) : (
              <>
                <Info className="size-2.5" /> Janela padrão
              </>
            )}
          </span>
        )}
      </div>

      {q.isLoading && <p className="text-xs text-muted-foreground">Calculando…</p>}

      {q.isError && (
        <p className="text-xs text-muted-foreground">
          Não foi possível calcular agora. Os horários padrão continuam valendo.
        </p>
      )}

      {data && (
        <>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Próxima janela
            </div>
            <div className="mt-1 text-lg font-bold leading-tight text-foreground">
              {fmtWhen(data.best.at)}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{data.best.reason}</p>
          </div>

          {data.topSlots.length > 1 && (
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Top horários
              </div>
              {data.topSlots.slice(0, 4).map((s) => (
                <div key={`${s.weekday}-${s.hourUtc}`} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs tabular-nums text-foreground">
                    {WEEKDAYS[s.weekday]} {String(localHour(s.hourUtc)).padStart(2, "0")}:00
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-brand transition-all"
                      style={{ width: `${Math.max(8, Math.round(s.score * 100))}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                    {s.confidence === "observed" ? `${s.samples}×` : "padrão"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-3 text-accent" />
              <span className="text-[11px] font-medium text-foreground">
                Cadência sustentável: {data.cadence.perWeek}×/semana
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {data.cadence.rationale}
            </p>
          </div>

          {data.usedFallback && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Ainda sem publicações medidas suficientes para personalizar. Após ~6 posts com
              métricas, este painel passa a usar o engajamento real da sua conta.
            </p>
          )}
        </>
      )}

      {rules && (
        <div className="border-t border-border pt-3">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Regra do formato
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">{rules.strategy}</p>
        </div>
      )}
    </div>
  );
}
