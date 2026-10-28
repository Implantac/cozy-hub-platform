import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListBlock } from "./atoms";

const CAUTION_MAP: Record<
  string,
  { label: string; icon: LucideIcon; ringClass: string; chipClass: string; barClass: string }
> = {
  green: {
    label: "Siga em frente",
    icon: CheckCircle2,
    ringClass: "ring-emerald-500/40",
    chipClass: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    barClass: "bg-emerald-500",
  },
  yellow: {
    label: "Cuidado",
    icon: AlertTriangle,
    ringClass: "ring-amber-500/40",
    chipClass: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    barClass: "bg-amber-500",
  },
  red: {
    label: "Não recomendado",
    icon: XCircle,
    ringClass: "ring-rose-500/40",
    chipClass: "bg-rose-500/15 text-rose-600 border-rose-500/30",
    barClass: "bg-rose-500",
  },
};

export function RealityCard({ r }: { r: any }) {
  const cau = CAUTION_MAP[r.caution_level] ?? CAUTION_MAP.yellow;
  const CauIcon = cau.icon;

  return (
    <div className={`section-card p-5 space-y-4 ring-1 ${cau.ringClass} animate-rise-in`}>
      <div className={`h-1 -m-5 mb-2 ${cau.barClass}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Badge variant="outline" className="mb-2">
            {r.change_type}
          </Badge>
          <p className="text-sm font-medium">{r.proposed_change}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(r.created_at).toLocaleString("pt-BR")}
          </p>
        </div>
        <Badge className={`shrink-0 border gap-1 ${cau.chipClass}`}>
          <CauIcon className="size-3" /> {cau.label}
        </Badge>
      </div>

      {r.summary && (
        <p className="text-sm leading-relaxed border-l-2 border-primary/40 pl-3">{r.summary}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ListBlock
          icon={TrendingUp}
          title="Indicadores positivos"
          tone="text-emerald-600"
          items={r.indicators_positive ?? []}
        />
        <ListBlock
          icon={AlertCircle}
          title="Sinais de alerta"
          tone="text-amber-600"
          items={r.indicators_warning ?? []}
        />
      </div>

      {r.questions_to_answer?.length > 0 && (
        <div className="rounded-lg bg-muted/40 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide mb-2">
            Perguntas a responder antes de decidir
          </div>
          <ul className="space-y-1.5 text-sm">
            {r.questions_to_answer.map((q: string, i: number) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">?</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.recommendations?.length > 0 && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight className="size-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide">Recomendações</span>
          </div>
          <ul className="space-y-1.5 text-sm">
            {r.recommendations.map((s: string, i: number) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">→</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
