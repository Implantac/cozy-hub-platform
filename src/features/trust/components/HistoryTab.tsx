import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { TrustOSService } from "@/lib/services";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/Skeletons";
import { Badge } from "@/components/ui/badge";
import { trustVerdictTone } from "../lib/verdict";
import type { TrustReportRow } from "../types";

function labelForTargetType(targetType: string): string {
  if (targetType === "before_you_buy") return "Before You Buy";
  if (targetType?.startsWith("trust:")) return targetType.replace("trust:", "");
  return targetType;
}

export function HistoryTab() {
  const list = useServerFn(TrustOSService.listTrustReports);
  const q = useWorkspaceQuery(
    (wsId) => ["trust-reports", wsId],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );

  if (q.isLoading) return <ListSkeleton rows={3} />;
  const rows = (q.data ?? []) as TrustReportRow[];
  if (rows.length === 0) {
    return <EmptyState text="Sem análises. Rode no Trust Analyzer ou Before You Buy." />;
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const tone = trustVerdictTone(r.verdict);
        return (
          <section key={r.id} className="section-card hover-lift p-4">
            <div className="flex items-start gap-3">
              <div
                className={`grid size-10 shrink-0 place-items-center rounded-lg border ${tone.bg}`}
              >
                <tone.Icon className={`size-5 ${tone.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.target_name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {labelForTargetType(r.target_type)}
                  </Badge>
                  <Badge className={`text-[10px] ${tone.color} ${tone.bg}`} variant="outline">
                    {tone.label} · {r.risk_score}
                  </Badge>
                </div>
                {r.summary && (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{r.summary}</p>
                )}
                <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                  {r.source_url && (
                    <a
                      href={r.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <ExternalLink className="size-3" /> Fonte
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
