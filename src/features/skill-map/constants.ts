export const AREAS = [
  { id: "copy",         label: "Copywriting",  why: "Palavras que convertem." },
  { id: "content",      label: "Conteúdo",     why: "Conexão constante com audiência." },
  { id: "product",      label: "Produto",      why: "Encaixe da oferta na dor real." },
  { id: "sales",        label: "Vendas",       why: "Conversa que vira receita." },
  { id: "branding",     label: "Marca",        why: "Reconhecimento e diferenciação." },
  { id: "analytics",    label: "Métricas",     why: "Decidir com dado, não palpite." },
  { id: "automation",   label: "Automação",    why: "Multiplica horas de trabalho." },
  { id: "prospecting",  label: "Prospecção",   why: "Conseguir clientes intencionalmente." },
  { id: "community",    label: "Comunidade",   why: "Tribo > audiência fria." },
  { id: "strategy",     label: "Estratégia",   why: "Foco e tradeoffs claros." },
] as const;

export type AreaId = (typeof AREAS)[number]["id"];
export type ScoredArea = { id: AreaId; label: string; why: string; score: number | null };
