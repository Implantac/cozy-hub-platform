import { z } from "zod";
import { isFetchableUrl } from "@/lib/scheduler/media";

export const mediaUrlsSchema = z
  .array(
    z
      .string()
      .trim()
      .max(2000)
      .refine(isFetchableUrl, "Use uma URL HTTPS pública, sem credenciais ou endereço local."),
  )
  .max(20);
export function parseMediaInput(value: string) {
  return value
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);
}
export function contentMediaUrls(media: unknown): string[] {
  if (!Array.isArray(media)) return [];
  return media
    .map((item) => (typeof item === "string" ? item : (item as { url?: unknown })?.url))
    .filter((url): url is string => typeof url === "string");
}
