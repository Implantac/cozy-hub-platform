/**
 * VELT — Media classification helpers (pure, testable).
 *
 * Publishers need to know, before spending a network round-trip, whether a URL
 * points at an image or a video, and whether the provider can fetch it at all.
 * Getting this wrong produces the single most common publishing failure in this
 * category: Meta downloads the asset asynchronously and only reports
 * "media could not be fetched" minutes after the API said 200 OK.
 */

const IMAGE_EXT = /\.(jpe?g|png|webp|heic|gif)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi)(\?|#|$)/i;

export type MediaKindDetected = "image" | "video" | "unknown";

export function detectMediaKind(url: string): MediaKindDetected {
  if (IMAGE_EXT.test(url)) return "image";
  if (VIDEO_EXT.test(url)) return "video";
  return "unknown";
}

/** Providers that fetch media by URL require a public HTTPS resource. */
export function isFetchableUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export interface MediaPrecheck {
  ok: boolean;
  problems: string[];
}

/**
 * Validates the media payload against a platform's requirements.
 * `requirements` comes from `platform-rules.ts`, keeping limits in one place.
 */
export function precheckMedia(
  urls: string[],
  requirements: { requiresMedia: boolean; maxItems?: number; acceptVideo?: boolean },
): MediaPrecheck {
  const problems: string[] = [];

  if (requirements.requiresMedia && urls.length === 0) {
    problems.push("A plataforma exige mídia e nenhum arquivo foi anexado.");
  }

  const max = requirements.maxItems ?? 20;
  if (urls.length > max) {
    problems.push(`Foram enviados ${urls.length} arquivos; o máximo da plataforma é ${max}.`);
  }

  for (const url of urls) {
    if (!isFetchableUrl(url)) {
      problems.push(
        `A mídia precisa estar em HTTPS público para a plataforma baixar: ${url.slice(0, 60)}…`,
      );
      continue;
    }
    const kind = detectMediaKind(url);
    if (kind === "unknown") {
      problems.push(
        `Não foi possível identificar o formato da mídia (use .jpg/.png/.mp4/.mov): ${url.slice(0, 60)}…`,
      );
    }
    if (kind === "video" && requirements.acceptVideo === false) {
      problems.push("Este formato aceita apenas imagem.");
    }
  }

  return { ok: problems.length === 0, problems };
}

/** Picks the first usable video, or the first image, from a mixed list. */
export function pickPrimaryMedia(urls: string[]): { kind: MediaKindDetected; url: string } | null {
  const video = urls.find((u) => detectMediaKind(u) === "video");
  if (video) return { kind: "video", url: video };
  const image = urls.find((u) => detectMediaKind(u) === "image");
  if (image) return { kind: "image", url: image };
  return urls[0] ? { kind: "unknown", url: urls[0] } : null;
}

/**
 * Meta caption assembly: Instagram has no separate title field, so the title is
 * folded into the caption. Exported separately because it is easy to get wrong
 * (duplicating the text when the body already starts with the title).
 */
export function composeCaption(
  title: string | null | undefined,
  body: string | null | undefined,
): string {
  const t = (title ?? "").trim();
  const b = (body ?? "").trim();
  if (!t) return b;
  if (!b) return t;
  if (b.startsWith(t)) return b;
  return `${t}\n\n${b}`;
}
