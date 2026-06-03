import { Flame, ArrowUp, Minus, AlertCircle, TrendingDown, type LucideIcon } from "lucide-react";

export const STATUS = [
  { id: undefined, label: "Todas" },
  { id: "exploding", label: "Em explosão" },
  { id: "growing", label: "Crescendo" },
  { id: "stable", label: "Estável" },
  { id: "saturated", label: "Saturado" },
  { id: "declining", label: "Em queda" },
] as const;

export type OpportunityStatusFilter = typeof STATUS[number]["id"];

export const STATUS_META: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  exploding: { icon: Flame, color: "text-destructive", label: "Em explosão" },
  growing: { icon: ArrowUp, color: "text-success", label: "Crescendo" },
  stable: { icon: Minus, color: "text-primary", label: "Estável" },
  saturated: { icon: AlertCircle, color: "text-accent", label: "Saturado" },
  declining: { icon: TrendingDown, color: "text-muted-foreground", label: "Em queda" },
};
