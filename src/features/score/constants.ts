export const PILLARS = [
  { key: "presence", label: "Presença" },
  { key: "branding", label: "Branding" },
  { key: "content", label: "Conteúdo" },
  { key: "consistency", label: "Consistência" },
  { key: "growth", label: "Crescimento" },
  { key: "channel_setup", label: "Setup de Canais" },
] as const;

export type PillarKey = typeof PILLARS[number]["key"];
