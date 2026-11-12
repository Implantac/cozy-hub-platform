/**
 * VELT — Publisher registry (server-only).
 *
 * Before this module was rewritten every platform routed to `stubPublish`,
 * which returned a synthetic id and logged "stub publish ok". The scheduler,
 * the retry logic and the DLQ were all real; only the last mile was fake, which
 * meant the product could never complete its loop.
 *
 * Now each platform routes to a real API implementation. Platforms without an
 * implementation are NOT silently stubbed — `publishToPlatform` throws a
 * non-retryable error so the job lands in the dead letter queue with an honest
 * reason instead of pretending to have published.
 *
 * Set `VELT_PUBLISHER_MODE=simulate` to force the old behaviour in local
 * development and demos. It is opt-in and loudly logged; in any other mode the
 * dispatcher talks to the real APIs.
 */

import { composeCaption, detectMediaKind, precheckMedia } from "./media";
import { PublisherError, type Platform, type PublishInput, type PublishResult } from "./contracts";
import { PLATFORM_RULES, rulesFor } from "@/lib/growth/platform-rules";
import { publishFacebook, publishInstagram } from "./publishers/meta.server";
import { publishYouTube } from "./publishers/youtube.server";
import { publishLinkedIn } from "./publishers/linkedin.server";
import { publishTikTok } from "./publishers/tiktok.server";
import { publishGoogleBusiness, googleBusinessPostBody } from "./publishers/google-business.server";

export type { Platform, PublishInput, PublishResult };
export { PublisherError };

export type PublisherFn = (input: PublishInput) => Promise<PublishResult>;

/**
 * Simulated publisher for local development only.
 * Never returns a "successful" publish unless explicitly enabled.
 */
async function simulatePublish(input: PublishInput): Promise<PublishResult> {
  const ts = Date.now();
  const externalPostId = `sim_${input.platform}_${ts}_${input.jobId.slice(0, 8)}`;
  console.warn(
    `[publisher:${input.platform}] MODO SIMULADO — nada foi publicado (job=${input.jobId})`,
  );
  return { externalPostId, raw: { simulated: true, ts } };
}

/**
 * Platform -> implementation.
 *
 * x / threads / pinterest are intentionally absent: their APIs require separate
 * app review that the project does not have yet. Calling publish on them
 * produces an explicit, non-retryable error.
 */
const REGISTRY: Partial<Record<Platform, PublisherFn>> = {
  instagram: publishInstagram,
  facebook: publishFacebook,
  youtube: publishYouTube,
  linkedin: publishLinkedIn,
  tiktok: publishTikTok,
  google_business: publishGoogleBusiness,
};

export function isPublishingImplemented(platform: string): boolean {
  return Boolean(REGISTRY[platform as Platform]);
}

export function implementedPlatforms(): Platform[] {
  return Object.keys(REGISTRY) as Platform[];
}

function simulatedMode(): boolean {
  return process.env.VELT_PUBLISHER_MODE === "simulate";
}

/**
 * Validates the payload against the platform's declared rules before spending a
 * network round-trip. Failures here are non-retryable: retrying an oversized
 * caption or a missing video will never succeed.
 */
export function preflightOrThrow(input: PublishInput): void {
  const rules = rulesFor(input.platform);
  if (!rules) {
    throw new PublisherError(`Plataforma sem regras registradas: ${input.platform}`, {
      retryable: false,
    });
  }

  if (input.platform === "google_business") googleBusinessPostBody(input);
  if (input.platform === "tiktok" && input.channelConfig.posting_mode === "inbox")
    throw new PublisherError(
      "TikTok no modo caixa de entrada não é publicação. Configure Direct Post.",
      { retryable: false },
    );
  const body = composeCaption(input.payload.title, input.payload.body);
  if (!body) throw new PublisherError("Inclua texto na publicação.", { retryable: false });
  if (
    rules.titleLimit &&
    (!input.payload.title?.trim() || input.payload.title.trim().length > rules.titleLimit)
  )
    throw new PublisherError(
      `O título do ${rules.label} deve ter de 1 a ${rules.titleLimit} caracteres.`,
      { retryable: false },
    );
  const urls = input.payload.media_urls ?? [];
  // Saving a media library is allowed, silently dropping attachments at delivery is not.
  if (urls.length > 1)
    throw new PublisherError(
      "Este fluxo publica um anexo por vez. Crie conteúdos separados; carrossel não está implementado.",
      { retryable: false },
    );
  if (
    ["youtube", "tiktok"].includes(input.platform) &&
    urls.some((url) => detectMediaKind(url) !== "video")
  )
    throw new PublisherError(`${rules.label} exige um arquivo de vídeo suportado.`, {
      retryable: false,
    });
  if (input.platform === "linkedin" && urls.some((url) => detectMediaKind(url) === "video"))
    throw new PublisherError(
      "Upload de vídeo do LinkedIn não está implementado. Use uma imagem ou texto.",
      { retryable: false },
    );
  if (body.length > rules.captionLimit) {
    throw new PublisherError(
      `Legenda com ${body.length} caracteres excede o limite de ${rules.captionLimit} do ${rules.label}. ` +
        "A publicação é rejeitada pela API — edite o conteúdo antes de reagendar.",
      { retryable: false },
    );
  }

  const acceptsVideo = rules.media.some((m) => m.kind === "video");
  const media = precheckMedia(input.payload.media_urls ?? [], {
    requiresMedia: rules.requiresMedia,
    acceptVideo: acceptsVideo,
    maxItems: 1,
  });

  if (!media.ok) {
    throw new PublisherError(`Mídia incompatível com ${rules.label}: ${media.problems.join(" ")}`, {
      retryable: false,
    });
  }
}

export async function publishToPlatform(input: PublishInput): Promise<PublishResult> {
  preflightOrThrow(input);

  if (simulatedMode()) {
    if (process.env.NODE_ENV === "production")
      throw new PublisherError("Simulação de publicação não é permitida em produção.", {
        retryable: false,
      });
    return simulatePublish(input);
  }

  const fn = REGISTRY[input.platform];
  if (!fn) {
    const label = PLATFORM_RULES[input.platform]?.label ?? input.platform;
    throw new PublisherError(
      `Publicação automática ainda não está habilitada para ${label}. ` +
        "Conecte um canal suportado (Instagram, Facebook, YouTube, LinkedIn, TikTok) ou publique manualmente.",
      { retryable: false },
    );
  }

  try {
    const result = await fn(input);
    if (
      !result ||
      typeof result.externalPostId !== "string" ||
      !result.externalPostId.trim() ||
      result.externalPostId.startsWith("sim_")
    )
      throw new PublisherError(
        "O provedor não retornou um identificador de publicação confirmado. Verifique o resultado no provedor antes de tentar novamente.",
        { retryable: false },
      );
    return result;
  } catch (err) {
    // Normalise provider-specific error shapes into the retry contract so the
    // dispatcher's DLQ decision stays correct across all providers.
    let message = err instanceof Error ? err.message : String(err);
    for (const key of ["access_token", "page_access_token", "pageAccessToken"]) {
      const secret = input.channelConfig[key];
      if (typeof secret === "string" && secret) {
        message = message
          .replaceAll(secret, "[redacted]")
          .replaceAll(encodeURIComponent(secret), "[redacted]");
      }
    }
    const candidate = err as { retryable?: boolean; externalPostId?: string };
    throw new PublisherError(message, {
      retryable: candidate?.retryable ?? false,
      externalPostId: candidate?.externalPostId,
    });
  }
}

/**
 * Configuration inventory only. This does not verify token validity,
 * provider app approval, publication permissions or external homologation.
 */
export function publisherCapabilities(): Array<{
  platform: Platform;
  implemented: boolean;
  credentialsReady: boolean;
  missingEnv: string[];
}> {
  const envByPlatform: Partial<Record<Platform, string[]>> = {
    instagram: ["META_APP_ID", "META_APP_SECRET"],
    facebook: ["META_APP_ID", "META_APP_SECRET"],
    youtube: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    linkedin: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    // Shares the Google OAuth client with YouTube.
    google_business: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  };

  return (Object.keys(PLATFORM_RULES) as Platform[]).map((platform) => {
    const needed = envByPlatform[platform] ?? [];
    const missingEnv = needed.filter((k) => !process.env[k]);
    if (platform === "tiktok" && process.env.TIKTOK_DIRECT_POST !== "true")
      missingEnv.push("TIKTOK_DIRECT_POST=true");
    return {
      platform,
      implemented: isPublishingImplemented(platform),
      credentialsReady: missingEnv.length === 0,
      missingEnv,
    };
  });
}
