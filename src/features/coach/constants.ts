import {
  AlertTriangle, Brain, Check, Lightbulb, Minus, Sparkles, Target,
  TrendingDown, TrendingUp,
} from "lucide-react";
import type { ElementType } from "react";

export const KIND_META: Record<string, { icon: ElementType; color: string; label: string }> = {
  insight: { icon: Lightbulb, color: "text-accent", label: "Insight" },
  warning: { icon: AlertTriangle, color: "text-destructive", label: "Aviso" },
  suggestion: { icon: Sparkles, color: "text-primary", label: "Sugestão" },
  next_action: { icon: Target, color: "text-success", label: "Próxima ação" },
};

export const MEMORY_META: Record<string, { icon: ElementType; color: string; label: string }> = {
  decision: { icon: Check, color: "text-success", label: "Decisão" },
  result: { icon: Target, color: "text-primary", label: "Resultado" },
  pivot: { icon: TrendingUp, color: "text-accent", label: "Virada de direção" },
  signal: { icon: Brain, color: "text-muted-foreground", label: "Sinal do Brain" },
  reflection: { icon: Lightbulb, color: "text-accent", label: "Reflexão" },
};

export const SENTIMENT_ICON: Record<string, { icon: ElementType; color: string }> = {
  positive: { icon: TrendingUp, color: "text-success" },
  neutral: { icon: Minus, color: "text-muted-foreground" },
  negative: { icon: TrendingDown, color: "text-destructive" },
};

export function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
