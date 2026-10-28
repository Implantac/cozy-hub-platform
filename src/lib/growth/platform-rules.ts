/**
 * VELT — Canonical platform rules (single source of truth).
 *
 * Before this file existed the supported-platform list was duplicated in three
 * places that disagreed with each other:
 *
 *   - `social_platform` enum in Postgres .......... 5 values
 *   - `Platform` in scheduler/publishers.server ... 8 values
 *   - manual channel form in the Navigator ........ 9 values
 *
 * Everything downstream (validation, scheduling, the composer, the publisher
 * registry) now derives from this module. To add a platform: add one entry
 * here, add one DB enum value, and register a publisher.
 *
 * LIMITS: these are the public, documented limits that gate a successful
 * publish. They are conservative on purpose — a limit that is too generous
 * silently produces failed jobs in production, which is far more expensive
 * than a slightly conservative preflight warning. Re-verify against each
 * provider's current API docs when onboarding a new channel type.
 */

export type PlatformId =
  | "instagram"
  | "facebook"
  | "youtube"
  | "tiktok"
  | "linkedin"
  | "x"
  | "threads"
  | "pinterest"
  | "google_business";

export type MediaKind = "image" | "video" | "carousel" | "text";

export interface PlatformMediaRule {
  kind: MediaKind;
  /** Preferred aspect ratio, expressed as width:height. */
  aspect: [number, number];
  minWidth: number;
  maxWidth: number;
  /** Max duration in seconds for video payloads. */
  maxDurationSec?: number;
  note?: string;
}

export interface PlatformRules {
  id: PlatformId;
  label: string;
  /** Hard limit on caption/body characters. Exceeding it fails the publish. */
  captionLimit: number;
  /** Character count above which the platform truncates with "... see more". */
  captionTruncateAt: number;
  /** Hard limit on the title field, when the platform has one. */
  titleLimit?: number;
  /** Max hashtags the platform accepts in one post. */
  hashtagLimit: number;
  /** Hashtag count the reach literature consistently favours. */
  hashtagSweetSpot: [number, number];
  media: PlatformMediaRule[];
  /** Whether a media attachment is mandatory. */
  requiresMedia: boolean;
  /** Whether links are clickable in-post (drives CTA strategy). */
  linksClickable: boolean;
  /** Baseline posting windows in the audience's local time (24h, UTC-3). */
  baselineWindows: Array<{ weekday: number[]; startHour: number; endHour: number }>;
  /** One-line strategic guidance surfaced in the composer. */
  strategy: string;
}

/** Baseline windows. Real audience heatmaps override these once available. */
const WEEKDAYS = [1, 2, 3, 4, 5];

export const PLATFORM_RULES: Record<PlatformId, PlatformRules> = {
  instagram: {
    id: "instagram",
    label: "Instagram",
    captionLimit: 2200,
    captionTruncateAt: 125,
    hashtagLimit: 30,
    hashtagSweetSpot: [3, 5],
    requiresMedia: true,
    linksClickable: false,
    media: [
      {
        kind: "image",
        aspect: [4, 5],
        minWidth: 1080,
        maxWidth: 1440,
        note: "Feed 4:5 ocupa mais tela que 1:1.",
      },
      {
        kind: "video",
        aspect: [9, 16],
        minWidth: 1080,
        maxWidth: 1080,
        maxDurationSec: 90,
        note: "Reels: 9:16, até 90s.",
      },
      { kind: "carousel", aspect: [4, 5], minWidth: 1080, maxWidth: 1440, note: "Até 20 itens." },
    ],
    baselineWindows: [
      { weekday: WEEKDAYS, startHour: 11, endHour: 13 },
      { weekday: WEEKDAYS, startHour: 19, endHour: 21 },
    ],
    strategy:
      "Primeira linha decide o alcance: gancho nos primeiros 125 caracteres. Link na bio, nunca no texto.",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    captionLimit: 2200,
    captionTruncateAt: 90,
    hashtagLimit: 20,
    hashtagSweetSpot: [3, 5],
    media: [{ kind: "video", aspect: [9, 16], minWidth: 1080, maxWidth: 1080 }],
    requiresMedia: true,
    linksClickable: false,
    baselineWindows: [
      { weekday: WEEKDAYS, startHour: 6, endHour: 9 },
      { weekday: WEEKDAYS, startHour: 19, endHour: 22 },
      { weekday: [0, 6], startHour: 10, endHour: 14 },
    ],
    strategy:
      "Retenção nos 3 primeiros segundos é tudo. Texto na tela desde o frame 1. Hashtags genéricas não trazem alcance.",
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    captionLimit: 5000,
    captionTruncateAt: 100,
    titleLimit: 100,
    hashtagLimit: 15,
    hashtagSweetSpot: [2, 3],
    media: [
      {
        kind: "video",
        aspect: [9, 16],
        minWidth: 1080,
        maxWidth: 1080,
        maxDurationSec: 180,
        note: "Shorts: até 3 min.",
      },
      { kind: "video", aspect: [16, 9], minWidth: 1280, maxWidth: 3840, note: "Formato longo." },
    ],
    requiresMedia: true,
    linksClickable: true,
    baselineWindows: [
      { weekday: [4, 5, 6, 0], startHour: 10, endHour: 14 },
      { weekday: WEEKDAYS, startHour: 18, endHour: 21 },
    ],
    strategy:
      "Título + thumbnail são 80% do clique. Primeiros 30 caracteres do título precisam fazer sentido sozinhos (mobile corta).",
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    captionLimit: 3000,
    captionTruncateAt: 210,
    hashtagLimit: 30,
    hashtagSweetSpot: [3, 5],
    media: [
      { kind: "image", aspect: [191, 100], minWidth: 1200, maxWidth: 1200 },
      { kind: "video", aspect: [1, 1], minWidth: 1080, maxWidth: 1080 },
    ],
    requiresMedia: false,
    linksClickable: true,
    baselineWindows: [
      { weekday: [2, 3, 4], startHour: 8, endHour: 10 },
      { weekday: [2, 3, 4], startHour: 12, endHour: 13 },
    ],
    strategy:
      "Corte em 210 caracteres: a linha antes do 'ver mais' precisa criar curiosidade. Link externo reduz alcance — considere link no primeiro comentário.",
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    captionLimit: 63206,
    captionTruncateAt: 120,
    hashtagLimit: 30,
    hashtagSweetSpot: [1, 2],
    media: [{ kind: "image", aspect: [191, 100], minWidth: 1200, maxWidth: 1200 }],
    requiresMedia: false,
    linksClickable: true,
    baselineWindows: [
      { weekday: WEEKDAYS, startHour: 12, endHour: 15 },
      { weekday: [0, 6], startHour: 10, endHour: 13 },
    ],
    strategy:
      "Texto curto e conversa nos comentários vencem. Poucas hashtags: aqui elas atrapalham mais que ajudam.",
  },
  x: {
    id: "x",
    label: "X / Twitter",
    captionLimit: 280,
    captionTruncateAt: 280,
    hashtagLimit: 10,
    hashtagSweetSpot: [0, 2],
    media: [{ kind: "image", aspect: [16, 9], minWidth: 1200, maxWidth: 1200 }],
    requiresMedia: false,
    linksClickable: true,
    baselineWindows: [{ weekday: WEEKDAYS, startHour: 9, endHour: 11 }],
    strategy:
      "Threads > post único para conteúdo denso. Zero hashtag performa melhor que hashtag genérica.",
  },
  threads: {
    id: "threads",
    label: "Threads",
    captionLimit: 500,
    captionTruncateAt: 300,
    hashtagLimit: 1,
    hashtagSweetSpot: [0, 1],
    media: [{ kind: "image", aspect: [4, 5], minWidth: 1080, maxWidth: 1440 }],
    requiresMedia: false,
    linksClickable: false,
    baselineWindows: [{ weekday: WEEKDAYS, startHour: 11, endHour: 14 }],
    strategy: "Conversa, não anúncio. Uma única hashtag no máximo.",
  },
  google_business: {
    id: "google_business",
    label: "Google Business",
    // "Posts" do GBP (novidades/ofertas/eventos) são curtos por design e
    // expiram: oferta dura o período informado, novidade ~7 dias.
    captionLimit: 1500,
    captionTruncateAt: 100,
    hashtagLimit: 10,
    hashtagSweetSpot: [0, 2],
    requiresMedia: false,
    linksClickable: true,
    media: [
      {
        kind: "image",
        aspect: [4, 3],
        minWidth: 720,
        maxWidth: 1200,
        note: "Google exige mínimo 720x540.",
      },
    ],
    // Não existem "janelas de engajamento" de feed aqui: o post fica indexado e
    // é servido por busca. A recomendação é cadência, não horário.
    baselineWindows: [{ weekday: [1, 2, 3, 4, 5], startHour: 9, endHour: 11 }],
    strategy:
      "É busca, não feed: título nas primeiras palavras, oferta com prazo e CTA de rota/telefone. Post expira em ~7 dias — cadência importa mais que horário.",
  },
  pinterest: {
    id: "pinterest",
    label: "Pinterest",
    captionLimit: 500,
    captionTruncateAt: 250,
    titleLimit: 100,
    hashtagLimit: 20,
    hashtagSweetSpot: [2, 4],
    media: [{ kind: "image", aspect: [2, 3], minWidth: 1000, maxWidth: 2000 }],
    requiresMedia: true,
    linksClickable: true,
    baselineWindows: [{ weekday: [0, 1, 2, 3, 4, 5, 6], startHour: 20, endHour: 23 }],
    strategy: "É busca, não feed: título e descrição contam como palavra-chave.",
  },
};

export const ALL_PLATFORMS = Object.keys(PLATFORM_RULES) as PlatformId[];

/** Platforms the workspace can actually publish to (OAuth implemented). */
export const PUBLISH_ENABLED: ReadonlySet<PlatformId> = new Set<PlatformId>([
  "instagram",
  "facebook",
  "youtube",
  "tiktok",
  "linkedin",
  "google_business",
]);

export function isPlatformId(v: string): v is PlatformId {
  return Object.prototype.hasOwnProperty.call(PLATFORM_RULES, v);
}

export function rulesFor(platform: string): PlatformRules | null {
  return isPlatformId(platform) ? PLATFORM_RULES[platform] : null;
}
