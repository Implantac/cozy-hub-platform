import { Briefcase, Compass, DollarSign, FileText, Megaphone, type LucideIcon } from "lucide-react";

export const SKILL_AREAS = [
  "copy",
  "content",
  "product",
  "sales",
  "branding",
  "analytics",
  "automation",
  "prospecting",
  "community",
  "strategy",
] as const;
export type SkillArea = (typeof SKILL_AREAS)[number];

export const ADVISORS = ["marketing", "financial", "strategy", "content", "business"] as const;
export type Advisor = (typeof ADVISORS)[number];

export const ADVISOR_META: Record<
  Advisor,
  { label: string; lens: string; icon: LucideIcon; tone: string }
> = {
  marketing: {
    label: "Marketing",
    lens: "Atração, posicionamento, funil",
    icon: Megaphone,
    tone: "text-pink-500 bg-pink-500/10 border-pink-500/30",
  },
  financial: {
    label: "Financeiro",
    lens: "Caixa, margem, sustentabilidade",
    icon: DollarSign,
    tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
  },
  strategy: {
    label: "Estratégia",
    lens: "Direção, foco, tradeoffs",
    icon: Compass,
    tone: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30",
  },
  content: {
    label: "Conteúdo",
    lens: "Narrativa, formato, cadência",
    icon: FileText,
    tone: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  },
  business: {
    label: "Negócio",
    lens: "Modelo, operação, escala",
    icon: Briefcase,
    tone: "text-sky-500 bg-sky-500/10 border-sky-500/30",
  },
};

export type BrainLabTab =
  | "twin"
  | "skills"
  | "experiments"
  | "decisions"
  | "anti_scam"
  | "council"
  | "timeline";

export type CouncilOpinion = {
  id: string;
  advisor: Advisor;
  topic: string;
  summary?: string | null;
  analysis?: string | null;
  recommendations?: string[] | null;
  confidence?: number | null;
  model_used?: string | null;
  created_at?: string;
};
