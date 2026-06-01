import type { BrainContext, EngineReport } from "../types";

/**
 * Trust Intelligence Engine — placeholder for evaluating external integrations.
 * Currently scores integration health only; external trust sources arrive in Brain-3.
 */
export function analyzeTrust(ctx: BrainContext): EngineReport {
  const signals: EngineReport["signals"] = [];
  // No external dataset yet. Use connected integrations + brand metadata.
  const brands = ctx.brands ?? [];
  const hasLogo = brands.filter((b) => b.logo_url).length;
  const hasVoice = brands.filter((b) => b.voice && Object.keys(b.voice).length > 0).length;

  if (brands.length > 0 && hasLogo === 0) {
    signals.push({ engine: "trust", kind: "negative", severity: "low", weight: 0.3,
      message: "Marcas sem logo reduzem confiabilidade percebida." });
  }
  if (brands.length > 0 && hasVoice === 0) {
    signals.push({ engine: "trust", kind: "negative", severity: "low", weight: 0.3,
      message: "Marcas sem voz definida soam genéricas." });
  }

  return {
    signals, actions: [],
    facts: { brandsWithLogo: hasLogo, brandsWithVoice: hasVoice },
  };
}
