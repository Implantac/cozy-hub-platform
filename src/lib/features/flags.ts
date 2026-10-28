/**
 * Feature flags.
 *
 * Why build-time flags and not runtime ones:
 *
 * A runtime flag (a row in the database, or a field on the workspace) would let
 * us flip Commerce on for one tenant without a deploy. That sounds better, and it
 * is wrong for this case: a surface hidden behind a runtime flag still ships its
 * JavaScript to every browser, still has its route in the bundle, and still has
 * to be reasoned about on every future change. The thing we want to avoid is
 * *maintaining* a product that does not exist yet, and a runtime flag does not
 * avoid that — it only hides it.
 *
 * These flags are resolved by Vite at build time. A disabled module's route and
 * UI are not reachable, and turning one on is a deliberate act with a deploy
 * behind it.
 *
 * Defaults are OFF. A flag that defaults to on is not a flag; it is a config
 * option waiting to be forgotten.
 *
 * To enable locally, put in `.env`:  VITE_FLAG_COMMERCE=true
 */

function readFlag(value: string | undefined): boolean {
  // Vite inlines import.meta.env values as strings. Anything other than an
  // explicit "true" stays off, so a typo fails closed instead of opening a door.
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

export const FEATURES = {
  /**
   * Commerce Hub: suppliers, dropshipping, marketplaces, product validation.
   *
   * Off because none of it exists. The page was four "em breve" cards in the
   * main navigation — a promise the product does not keep, on every screen, for
   * every user. Shipping the shell before the substance teaches people to ignore
   * what we announce.
   */
  commerce: readFlag(import.meta.env.VITE_FLAG_COMMERCE),
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isFeatureEnabled(name: FeatureName): boolean {
  return FEATURES[name];
}
