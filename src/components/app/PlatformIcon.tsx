import { Facebook, Instagram, Linkedin, MapPin, Music2, Radio, Youtube } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type PlatformId =
  "instagram" | "facebook" | "youtube" | "tiktok" | "linkedin" | "google_business";

export interface PlatformMeta {
  id: PlatformId;
  label: string;
  Icon: LucideIcon;
  /** Provider id used by the OAuth layer (YouTube uses Google). */
  oauth: string;
}

export const PLATFORMS: readonly PlatformMeta[] = [
  { id: "instagram", label: "Instagram", Icon: Instagram, oauth: "instagram" },
  { id: "facebook", label: "Facebook", Icon: Facebook, oauth: "facebook" },
  { id: "youtube", label: "YouTube", Icon: Youtube, oauth: "google" },
  { id: "tiktok", label: "TikTok", Icon: Music2, oauth: "tiktok" },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin, oauth: "linkedin" },
  // Único canal de busca local: decisivo para negócio com endereço físico.
  { id: "google_business", label: "Google Business", Icon: MapPin, oauth: "google_business" },
] as const;

export function getPlatformMeta(id: string | null | undefined): PlatformMeta | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

export function getPlatformIcon(id: string | null | undefined): LucideIcon {
  return getPlatformMeta(id)?.Icon ?? Radio;
}
