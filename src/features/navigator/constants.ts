export const BUSINESS_PATHS = [
  { id: "local_business", label: "Negócio Local", desc: "Loja, restaurante, serviço presencial" },
  { id: "content_creator", label: "Criador de Conteúdo", desc: "Audiência + monetização" },
  { id: "affiliate", label: "Afiliado", desc: "Vender produtos de terceiros" },
  { id: "digital_services", label: "Serviços Digitais", desc: "Consultoria, design, dev" },
  { id: "saas_builder", label: "SaaS / Produto", desc: "Software com receita recorrente" },
  { id: "agency", label: "Agência", desc: "Serviços para outras empresas" },
  { id: "freelancer", label: "Freelancer", desc: "Projetos sob demanda" },
  { id: "ecommerce", label: "E-commerce", desc: "Loja online de produtos físicos" },
] as const;

export type BusinessPathId = typeof BUSINESS_PATHS[number]["id"];

export const GOALS = [
  "Primeiros clientes", "Construir audiência", "Lançar produto",
  "Aumentar vendas", "Crescer presença", "Automatizar processos",
  "Validar ideia", "Reduzir custos",
];

export const CHANNELS = [
  "Instagram", "Facebook", "TikTok", "YouTube", "LinkedIn",
  "WhatsApp", "Google Business", "X / Twitter", "Email",
];

export const CONTENT_TYPES = ["Posts", "Reels", "Vídeos longos", "Carrosséis", "Stories", "Lives", "Newsletter"];

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type NavigatorForm = {
  experience_level: ExperienceLevel;
  business_path: BusinessPathId | null;
  goals: string[];
  time_budget_hours_week: number;
  money_budget_monthly: number;
  preferred_channels: string[];
  content_preferences: string[];
};
