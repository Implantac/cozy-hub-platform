/**
 * VELT — Meta Graph publishers (Facebook Page + Instagram Business).
 *
 * Instagram publishing is a three-step, asynchronous protocol. Almost every
 * "publishing is broken" bug in this category comes from treating it as a single
 * call:
 *
 *   1. POST /{ig-user-id}/media        -> returns a creation_id (container)
 *   2. GET  /{creation_id}?fields=status_code  -> poll until FINISHED
 *   3. POST /{ig-user-id}/media_publish -> publishes the container
 *
 * Step 2 is mandatory for video: Meta downloads and transcodes the asset, which
 * takes seconds to minutes. Publishing a container that is still IN_PROGRESS
 * returns an error that looks unrelated. Facebook Pages, by contrast, publish
 * synchronously — one call with the photo or feed edge.
 *
 * Both paths require a Page/IG access token, which is NOT the user token:
 * the user token must be exchanged for the page token first. We look it up from
 * the channel's stored metadata and fail loudly with actionable text if absent.
 */

import { composeCaption, detectMediaKind, isFetchableUrl, pickPrimaryMedia } from "../media";
import type { PublishInput, PublishResult } from "../contracts";

export class MetaError extends Error {
  readonly retryable: boolean;
  readonly code?: number;
  constructor(message: string, opts: { retryable?: boolean; code?: number } = {}) {
    super(message);
    this.name = "MetaError";
    this.retryable = opts.retryable ?? true;
    this.code = opts.code;
  }
}

const GRAPH = "https://graph.facebook.com/v19.0";

/** Polling budget for the Instagram container. */
const CONTAINER_POLL_TIMEOUT_MS = 120_000;
const CONTAINER_POLL_INTERVAL_MS = 4_000;

interface GraphError {
  error?: { message?: string; code?: number; error_subcode?: number; is_transient?: boolean };
}

async function graphFetch<T>(
  path: string,
  init: RequestInit & { query?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(`${GRAPH}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url, init);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body: fall through with the raw text */
  }

  if (!res.ok) {
    const err = (json as GraphError)?.error;
    const msg = err?.message ?? text.slice(0, 300);
    // 190 = invalid/expired token (not retryable), 4/17 = rate limit (retryable)
    const retryable =
      err?.is_transient === true || err?.code === 4 || err?.code === 17 || res.status >= 500;
    throw new MetaError(`Meta ${res.status}: ${msg}`, { retryable, code: err?.code });
  }
  return json as T;
}

/** Resolves the page/IG token from channel metadata, with a clear failure. */
function resolvePageToken(channelConfig: Record<string, unknown>): string {
  const token =
    (channelConfig.page_access_token as string | undefined) ??
    (channelConfig.pageAccessToken as string | undefined);
  if (!token) {
    throw new MetaError(
      "Canal sem page_access_token. Reconecte o canal pela tela de Canais para autorizar a Página e o Instagram.",
      { retryable: false },
    );
  }
  return token;
}

function resolveIgUserId(channelConfig: Record<string, unknown>, externalId?: string): string {
  const id =
    (channelConfig.ig_user_id as string | undefined) ??
    (channelConfig.igUserId as string | undefined) ??
    externalId;
  if (!id) {
    throw new MetaError("Canal do Instagram sem ig_user_id — reconecte o canal.", {
      retryable: false,
    });
  }
  return id;
}

/* ------------------------------------------------------------------ */
/* Instagram                                                           */
/* ------------------------------------------------------------------ */

async function pollContainer(containerId: string, token: string): Promise<void> {
  const deadline = Date.now() + CONTAINER_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const status = await graphFetch<{ status_code?: string; status?: string }>(containerId, {
      query: { fields: "status_code,status", access_token: token },
    });

    if (status.status_code === "FINISHED") return;

    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new MetaError(
        `Container do Instagram terminou com ${status.status_code}: ${status.status ?? "sem detalhe"}. ` +
          "Normalmente indica mídia inacessível, formato inválido ou proporção fora do aceito.",
        { retryable: false },
      );
    }
    // IN_PROGRESS / PUBLISHED: keep waiting
    await new Promise((r) => setTimeout(r, CONTAINER_POLL_INTERVAL_MS));
  }

  throw new MetaError(
    `Instagram não finalizou o processamento da mídia em ${CONTAINER_POLL_TIMEOUT_MS / 1000}s.`,
    { retryable: true },
  );
}

export async function publishInstagram(input: PublishInput): Promise<PublishResult> {
  const token = resolvePageToken(input.channelConfig);
  const igUserId = resolveIgUserId(input.channelConfig, input.channelConfig.external_id as string);
  const caption = composeCaption(input.payload.title, input.payload.body);
  const mediaUrls = (input.payload.media_urls ?? []).filter(isFetchableUrl);
  const primary = pickPrimaryMedia(mediaUrls);

  if (!primary) {
    throw new MetaError("Instagram exige mídia. Anexe uma imagem ou vídeo público em HTTPS.", {
      retryable: false,
    });
  }

  const isVideo = primary.kind === "video" || primary.kind === "unknown";

  // Step 1 — create the container.
  const containerParams: Record<string, string> = {
    access_token: token,
    caption,
  };
  if (isVideo) {
    containerParams.media_type = "REELS";
    containerParams.video_url = primary.url;
  } else {
    containerParams.image_url = primary.url;
  }

  const created = await graphFetch<{ id: string }>(`${igUserId}/media`, {
    method: "POST",
    query: containerParams,
  });
  if (!created?.id) throw new MetaError("Instagram não retornou creation_id.", { retryable: true });

  // Step 2 — wait for the container to be ready.
  await pollContainer(created.id, token);

  // Step 3 — publish.
  const published = await graphFetch<{ id: string }>(`${igUserId}/media_publish`, {
    method: "POST",
    query: { creation_id: created.id, access_token: token },
  });
  if (!published?.id)
    throw new MetaError("Instagram não retornou o id da publicação.", { retryable: true });

  return { externalPostId: published.id, raw: { container_id: created.id } };
}

/* ------------------------------------------------------------------ */
/* Facebook Page                                                       */
/* ------------------------------------------------------------------ */

export async function publishFacebook(input: PublishInput): Promise<PublishResult> {
  const token = resolvePageToken(input.channelConfig);
  const pageId =
    (input.channelConfig.page_id as string | undefined) ??
    (input.channelConfig.external_id as string);
  if (!pageId) {
    throw new MetaError("Canal do Facebook sem page_id — reconecte o canal.", { retryable: false });
  }

  const message = composeCaption(input.payload.title, input.payload.body);
  const mediaUrls = (input.payload.media_urls ?? []).filter(isFetchableUrl);
  const primary = pickPrimaryMedia(mediaUrls);

  // Photo posts carry the caption in the `caption` field, not `message`.
  if (primary && primary.kind === "image") {
    const photo = await graphFetch<{ id: string; post_id?: string }>(`${pageId}/photos`, {
      method: "POST",
      query: { url: primary.url, caption: message, access_token: token },
    });
    return { externalPostId: photo.post_id ?? photo.id, raw: { photo_id: photo.id } };
  }

  if (primary && primary.kind === "video") {
    // Feed videos are uploaded by URL; Meta fetches asynchronously.
    const video = await graphFetch<{ id: string }>(`${pageId}/videos`, {
      method: "POST",
      query: { file_url: primary.url, description: message, access_token: token },
    });
    return { externalPostId: video.id, raw: { video_id: video.id } };
  }

  const post = await graphFetch<{ id: string }>(`${pageId}/feed`, {
    method: "POST",
    query: { message, access_token: token },
  });
  return { externalPostId: post.id };
}

/** Utility used by tests and by the preflight panel's format hints. */
export const __metaInternals = { resolvePageToken, detectMediaKind };
