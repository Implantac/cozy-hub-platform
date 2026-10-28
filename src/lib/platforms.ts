import type { Database } from "@/integrations/supabase/types";

/**
 * The publishable platforms — one list, typed against the database enum.
 *
 * Why this exists
 * ---------------
 * "Which platforms does VELT publish to?" had three different answers in the
 * codebase:
 *
 *   - the database enum: instagram, facebook, youtube, tiktok, linkedin,
 *     google_business
 *   - `PLATFORMS` in the icon component: the same six
 *   - the Brain's business engine: the same six **plus `whatsapp` and
 *     `twitter`**, which it recommended as priority channels
 *
 * The third was the problem. `whatsapp` and `twitter` do not exist in the enum,
 * have no publisher, and cannot be connected — so the engine's "priority
 * channels" advice pointed at two channels the product cannot deliver, while
 * being typed as `string[]` and therefore never flagged.
 *
 * `Database["public"]["Enums"]["social_platform"]` is generated from the live
 * database. Deriving the list from it means a platform cannot be recommended
 * here without existing there first: if the enum drops a value, this file stops
 * compiling.
 */
export type Platform = Database["public"]["Enums"]["social_platform"];

/** Where the list is derived from — kept for runtime iteration and ordering. */
export const PLATFORMS: readonly Platform[] = [
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
  "linkedin",
  "google_business",
] as const satisfies readonly Platform[];

const PLATFORM_SET = new Set<string>(PLATFORMS);

export function isPlatform(value: string): value is Platform {
  return PLATFORM_SET.has(value);
}

/** Display names. Kept separate from the UI so logic can name a platform too. */
export const PLATFORM_LABELS: Readonly<Record<Platform, string>> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  google_business: "Google Business",
} as const;

/**
 * Channels worth recommending for a given business path.
 *
 * Every entry must be a `Platform`, which is what keeps this honest: the
 * compiler rejects a suggestion the product cannot fulfil.
 */
export function priorityPlatformsFor(businessPath: string | undefined): readonly Platform[] {
  const byPath: Readonly<Record<string, readonly Platform[]>> = {
    local_business: ["google_business", "instagram"],
    content_creator: ["instagram", "tiktok", "youtube"],
    affiliate: ["instagram", "tiktok", "youtube"],
    digital_services: ["linkedin", "instagram"],
    saas_builder: ["linkedin", "youtube"],
    agency: ["linkedin", "instagram"],
    freelancer: ["linkedin", "instagram"],
    ecommerce: ["instagram", "tiktok", "google_business"],
  };
  return businessPath ? (byPath[businessPath] ?? []) : [];
}
