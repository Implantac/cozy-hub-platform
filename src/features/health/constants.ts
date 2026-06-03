import { Megaphone, FileText, Palette, Radio, TrendingUp, type LucideIcon } from "lucide-react";

export const CAT_META: Record<string, { icon: LucideIcon; label: string }> = {
  marketing: { icon: Megaphone, label: "Marketing" },
  content: { icon: FileText, label: "Conteúdo" },
  brand: { icon: Palette, label: "Marca" },
  channel: { icon: Radio, label: "Canais" },
  growth: { icon: TrendingUp, label: "Crescimento" },
};
