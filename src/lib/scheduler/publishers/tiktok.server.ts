/**
 * VELT — TikTok publisher (Content Posting API).
 *
 * TikTok is the least forgiving of the five: it requires a direct upload of the
 * bytes (no URL fetch), the video must already satisfy the platform's encoding
 * rules, and the creator info call must be made before every post.
 *
 * Two posting modes exist:
 *   - DIRECT_POST : publishes immediately to the profile
 *   - UPLOAD      : sends to the creator's inbox as a draft for manual review
 *
 * We default to UPLOAD when the app has not been approved for Direct Post,
 * because a failed Direct Post is invisible to the user while a draft in the
 * inbox is at least recoverable. The mode is configurable per channel.
 */

import { composeCaption, detectMediaKind, isFetchableUrl } from "../media";
import { PublisherError } from "../contracts";
import type { PublishInput, PublishResult } from "../contracts";

const TIKTOK_API = "https://open.tiktokapis.com/v2";
const MAX_BYTES = 128 * 1024 * 1024;

function token(input: PublishInput): string {
  const t =
    (input.channelConfig.access_token as string | undefined) ??
    (input.channelConfig.accessToken as string | undefined);
  if (!t) {
    throw new PublisherError("Canal do TikTok sem access_token — reconecte o canal.", {
      retryable: false,
    });
  }
  return t;
}

type TikTokMode = "direct" | "inbox";

function postingMode(input: PublishInput): TikTokMode {
  const configured = (input.channelConfig.posting_mode as string | undefined)?.toLowerCase();
  if (configured === "direct" || configured === "inbox") return configured;
  // Safe default: draft in the inbox.
  return process.env.TIKTOK_DIRECT_POST === "true" ? "direct" : "inbox";
}

export async function publishTikTok(input: PublishInput): Promise<PublishResult> {
  const accessToken = token(input);

  const videoUrl = (input.payload.media_urls ?? []).find(
    (u) => isFetchableUrl(u) && detectMediaKind(u) === "video",
  );
  if (!videoUrl) {
    throw new PublisherError("TikTok aceita apenas vídeo (.mp4/.mov) público em HTTPS.", {
      retryable: false,
    });
  }

  const asset = await fetch(videoUrl);
  if (!asset.ok) {
    throw new PublisherError(`Não foi possível baixar o vídeo do storage (${asset.status}).`, {
      retryable: asset.status >= 500,
    });
  }
  const bytes = new Uint8Array(await asset.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) {
    throw new PublisherError(
      `Vídeo com ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB excede o limite do worker ` +
        `(${MAX_BYTES / 1024 / 1024} MB). Comprima antes de publicar.`,
      { retryable: false },
    );
  }

  const mode = postingMode(input);
  const caption = composeCaption(input.payload.title, input.payload.body).slice(0, 2200);

  // 1. Initialise the upload.
  const initRes = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: caption,
        privacy_level: mode === "direct" ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: bytes.byteLength,
        chunk_size: bytes.byteLength,
        total_chunk_count: 1,
      },
      post_mode: mode === "direct" ? "DIRECT_POST" : "MEDIA_UPLOAD",
      media_type: "VIDEO",
    }),
  });

  const initText = await initRes.text();
  let initJson: {
    data?: { publish_id?: string; upload_url?: string };
    error?: { code?: string; message?: string };
  } = {};
  try {
    initJson = JSON.parse(initText);
  } catch {
    /* fall through */
  }

  const errCode = initJson.error?.code;
  if (!initRes.ok || (errCode && errCode !== "ok")) {
    const detail = initJson.error?.message ?? initText.slice(0, 300);
    throw new PublisherError(`TikTok recusou a inicialização (${initRes.status}): ${detail}`, {
      retryable: initRes.status >= 500 || initRes.status === 429,
    });
  }

  const publishId = initJson.data?.publish_id;
  const uploadUrl = initJson.data?.upload_url;
  if (!publishId || !uploadUrl) {
    throw new PublisherError("TikTok não retornou publish_id/upload_url.", { retryable: true });
  }

  // 2. Upload the bytes in a single chunk.
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}`,
    },
    body: bytes,
  });
  if (!put.ok) {
    throw new PublisherError(
      `Upload para o TikTok falhou (${put.status}). Isso costuma indicar formato de vídeo fora do padrão.`,
      { retryable: put.status >= 500 },
    );
  }

  return {
    externalPostId: publishId,
    raw: {
      mode,
      bytes: bytes.byteLength,
      note: mode === "inbox" ? "enviado como rascunho na caixa de entrada do criador" : undefined,
    },
  };
}
