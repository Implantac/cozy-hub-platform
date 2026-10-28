import {
  ArrowRight,
  DollarSign,
  Layers,
  MessageSquare,
  Rocket,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

export type BlockId =
  | "problem"
  | "audience"
  | "promise"
  | "differentiator"
  | "offer"
  | "price"
  | "channels"
  | "content_pillars"
  | "funnel"
  | "metric";

export type Block = {
  id: BlockId;
  label: string;
  question: string;
  icon: typeof Target;
  category: "essência" | "oferta" | "distribuição" | "operação";
};

export const BLOCKS: Block[] = [
  {
    id: "problem",
    label: "Problema",
    question: "Qual dor real você resolve?",
    icon: Target,
    category: "essência",
  },
  {
    id: "audience",
    label: "Público",
    question: "Para quem exatamente — em uma frase?",
    icon: Users,
    category: "essência",
  },
  {
    id: "promise",
    label: "Promessa",
    question: "O que entrega que ninguém entrega?",
    icon: Sparkles,
    category: "essência",
  },
  {
    id: "differentiator",
    label: "Diferencial",
    question: "Por que escolheriam você e não o concorrente?",
    icon: Layers,
    category: "essência",
  },
  {
    id: "offer",
    label: "Oferta principal",
    question: "O que vende, com nome e formato claros?",
    icon: Rocket,
    category: "oferta",
  },
  {
    id: "price",
    label: "Preço",
    question: "Quanto custa e por quê esse valor?",
    icon: DollarSign,
    category: "oferta",
  },
  {
    id: "channels",
    label: "Canais",
    question: "Onde seu público realmente está?",
    icon: MessageSquare,
    category: "distribuição",
  },
  {
    id: "content_pillars",
    label: "Pilares de conteúdo",
    question: "Quais 3 temas você sustenta com autoridade?",
    icon: Layers,
    category: "distribuição",
  },
  {
    id: "funnel",
    label: "Funil",
    question: "Como alguém vai de descobrir → comprar?",
    icon: ArrowRight,
    category: "distribuição",
  },
  {
    id: "metric",
    label: "Métrica-norte",
    question: "Que número, se subir, prova que está dando certo?",
    icon: Target,
    category: "operação",
  },
];

export const CATEGORIES: Array<Block["category"]> = [
  "essência",
  "oferta",
  "distribuição",
  "operação",
];

export type Blueprint = Partial<Record<BlockId, string | null>>;
