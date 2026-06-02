import {
  AlertTriangle,
  CheckCircle2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export interface VerdictTone {
  color: string;
  bg: string;
  label: string;
  Icon: LucideIcon;
}

/** Map a backend verdict string to label, tone classes and icon. */
export function trustVerdictTone(v: string): VerdictTone {
  switch (v) {
    case "safe":
      return { color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30", label: "Seguro", Icon: ShieldCheck };
    case "caution":
      return { color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30", label: "Atenção", Icon: AlertTriangle };
    case "risky":
      return { color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/30", label: "Arriscado", Icon: ShieldAlert };
    case "avoid":
      return { color: "text-red-500", bg: "bg-red-500/10 border-red-500/30", label: "Evitar", Icon: XCircle };
    case "buy":
      return { color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30", label: "Pode comprar", Icon: CheckCircle2 };
    case "negotiate":
      return { color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/30", label: "Negocie", Icon: Sparkles };
    case "wait":
      return { color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30", label: "Aguarde", Icon: AlertTriangle };
    case "skip":
      return { color: "text-red-500", bg: "bg-red-500/10 border-red-500/30", label: "Não compre", Icon: XCircle };
    default:
      return { color: "text-muted-foreground", bg: "bg-muted/10 border-border", label: v, Icon: Shield };
  }
}
