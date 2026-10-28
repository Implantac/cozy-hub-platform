import { Compass, Flag, Star, Target } from "lucide-react";
import type { ElementType } from "react";

export type MemoryKind = "fact" | "goal" | "preference" | "strategy";
export type RecStatus = "open" | "applied" | "dismissed" | "expired";

export const MEMORY_META: Record<MemoryKind, { icon: ElementType; color: string; label: string }> =
  {
    goal: { icon: Flag, color: "text-primary", label: "Objetivo" },
    fact: { icon: Compass, color: "text-accent", label: "Fato" },
    preference: { icon: Star, color: "text-success", label: "Preferência" },
    strategy: { icon: Target, color: "text-destructive", label: "Estratégia" },
  };

export const MEMORY_KINDS: readonly MemoryKind[] = [
  "goal",
  "fact",
  "preference",
  "strategy",
] as const;
