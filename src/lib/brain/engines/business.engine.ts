import type { BrainContext, EngineReport } from "../types";

/** Business Intelligence Engine — understands the business stage and channel priorities. */
export function analyzeBusiness(ctx: BrainContext): EngineReport {
  const signals: EngineReport["signals"] = [];
  const actions: EngineReport["actions"] = [];
  const brands = ctx.brands ?? [];
  const channels = ctx.channels ?? [];

  const connected = channels.filter((c) => c.status === "connected").length;
  const stage =
    brands.length === 0 ? "no_identity"
    : channels.length === 0 ? "identity_only"
    : connected < 2 ? "single_channel"
    : connected < 4 ? "multi_channel" : "omnichannel";

  if (brands.length === 0) {
    signals.push({ engine: "business", kind: "negative", severity: "high", weight: 0.9,
      message: "Sem marca digital — toda comunicação fica genérica." });
    actions.push({ engine: "business", score: 92, title: "Criar marca digital",
      rationale: "Voz, paleta e logo são pré-requisitos para qualquer conteúdo consistente.",
      href: "/app/brands" });
  }

  if (channels.length < 2) {
    signals.push({ engine: "business", kind: "negative", severity: "high", weight: 0.8,
      message: "Menos de 2 canais — concentração de risco e alcance limitado." });
  }

  const disconnected = channels.length - connected;
  if (disconnected > 0) {
    signals.push({ engine: "business", kind: "negative", severity: "medium", weight: 0.6,
      message: `${disconnected} canal(is) desconectado(s) — publicações pararão.` });
    actions.push({ engine: "business", score: 78, title: "Reconectar canais",
      rationale: "Canais desconectados não publicam e diluem o score.",
      href: "/app/channels" });
  }

  // Suggest priority channels by business_path
  const path = ctx.profile?.business_path;
  const priorityByPath: Record<string, string[]> = {
    local_business: ["google_business", "instagram", "whatsapp"],
    content_creator: ["instagram", "tiktok", "youtube"],
    affiliate: ["instagram", "tiktok", "youtube"],
    digital_services: ["linkedin", "instagram"],
    saas_builder: ["linkedin", "twitter", "youtube"],
    agency: ["linkedin", "instagram"],
    freelancer: ["linkedin", "instagram"],
    ecommerce: ["instagram", "tiktok", "google_business"],
  };
  const priority = path ? (priorityByPath[path] ?? []) : [];

  // Business Blueprint (Manifesto Builder) — 10 strategic blocks
  const BP_FIELDS = ["problem","audience","promise","differentiator","offer","price","channels","content_pillars","funnel","metric"] as const;
  const bp = ctx.blueprint;
  const bpFilled = bp ? BP_FIELDS.filter((f) => (bp as any)[f] && String((bp as any)[f]).trim().length > 0).length : 0;
  const bpPct = Math.round((bpFilled / BP_FIELDS.length) * 100);
  if (!bp || bpFilled === 0) {
    signals.push({ engine: "business", kind: "negative", severity: "high", weight: 0.85,
      message: "Modelo de negócio vazio — sem promessa, oferta ou métrica definidas." });
    actions.push({ engine: "business", score: 88, title: "Preencher Business Blueprint",
      rationale: "Os 10 blocos do Builder definem promessa, oferta e funil.", href: "/app/builder" });
  } else if (bpFilled < 6) {
    signals.push({ engine: "business", kind: "negative", severity: "medium", weight: 0.55,
      message: `Blueprint só ${bpPct}% completo — decisões ficam sem âncora.` });
    actions.push({ engine: "business", score: 70, title: "Completar Business Blueprint",
      rationale: `Faltam ${BP_FIELDS.length - bpFilled} bloco(s) para fechar o modelo.`, href: "/app/builder" });
  }

  return {
    signals, actions,
    facts: { stage, brands: brands.length, channels: channels.length, connected, priority,
      blueprintCompletion: bpPct, blueprintFilled: bpFilled },
  };
}
