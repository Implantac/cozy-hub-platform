/**
 * VELT — YouTube publisher (YouTube Data API v3).
 *
 * Upload is a two-phase protocol:
 *   1. POST  https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable
 *      -> returns a resumable upload URI in the Location header
 *   2. PUT  the video bytes to that URI
 *
 * The bytes must come from somewhere: YouTube requires the binary, not a URL.
 * So the publisher downloads the asset from storage first. This is the one
 * platform where a published job genuinely consumes bandwidth and where a large
 * file can exceed a request timeout — hence the explicit size guard, which fails
 * fast with an actionable message instead of timing out mysteriously.
 */

import { composeCaption, detectMediaKind, isFetchableUrl } from "../media";
import { PublisherError } from "../contracts";
import type { PublishInput, PublishResult } from "../contracts";

const UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/youtube/v3/videos";
/** Guard: above this we refuse rather than hang. 128 MB ≈ 2.5 min of 720p. */
const MAX_UPLOAD_BYTES = 128 * 1024 * 1024;

function accessTokenFor(input: PublishInput): string {
  const t =
    (input.channelConfig.access_token as string | undefined) ??
    (input.channelConfig.accessToken as string | undefined);
  if (!t) {
    throw new PublisherError(
      "Canal do YouTube sem access_token — reconecte o canal antes de publicar.",
      { retryable: false },
    );
  }
  return t;
}

export async function publishYouTube(input: PublishInput): Promise<PublishResult> {
  const token = accessTokenFor(input);
  const videoUrl = (input.payload.media_urls ?? []).find(
    (u) => isFetchableUrl(u) && detectMediaKind(u) === "video",
  );
  if (!videoUrl) {
    throw new PublisherError("YouTube exige um arquivo de vídeo público (.mp4/.mov) em HTTPS.", {
      retryable: false,
    });
  }

  // 1. Download the asset.
  const asset = await fetch(videoUrl);
  if (!asset.ok) {
    throw new PublisherError(
      `Não foi possível baixar o vídeo do storage (${asset.status}). Verifique se o arquivo é público.`,
      { retryable: asset.status >= 500 },
    );
  }
  const declared = Number(asset.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES) {
    throw new PublisherError(
      `Vídeo com ${(declared / 1024 / 1024).toFixed(1)} MB excede o limite de upload deste worker (${MAX_UPLOAD_BYTES / 1024 / 1024} MB). ` +
        "Comprima o arquivo ou envie pelo YouTube Studio.",
      { retryable: false },
    );
  }
  const bytes = new Uint8Array(await asset.arrayBuffer());
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new PublisherError("Vídeo maior que o limite de upload do worker.", { retryable: false });
  }

  // 2. Start a resumable session.
  const title = (input.payload.title ?? "").trim().slice(0, 100) || "Publicação VELT";
  const description = composeCaption(null, input.payload.body).slice(0, 5000);

  const startUrl = new URL(UPLOAD_ENDPOINT);
  startUrl.searchParams.set("uploadType", "resumable");
  startUrl.searchParams.set("part", "snippet,status");

  const start = await fetch(startUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(bytes.byteLength),
      "X-Upload-Content-Type": "video/*",
    },
    body: JSON.stringify({
      snippet: { title, description, categoryId: "22" },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    }),
  });

  if (!start.ok) {
    const detail = (await start.text()).slice(0, 300);
    throw new PublisherError(`YouTube recusou a criação do upload (${start.status}): ${detail}`, {
      retryable: start.status >= 500 || start.status === 429,
    });
  }

  const uploadUri = start.headers.get("location");
  if (!uploadUri) {
    throw new PublisherError("YouTube não retornou a URI de upload.", { retryable: true });
  }

  // 3. Upload the bytes.
  const upload = await fetch(uploadUri, {
    method: "PUT",
    headers: { "Content-Type": "video/*", "Content-Length": String(bytes.byteLength) },
    body: bytes,
  });

  const text = await upload.text();
  let json: { id?: string } = {};
  try {
    json = JSON.parse(text) as { id?: string };
  } catch {
    /* fall through */
  }

  if (!upload.ok || !json.id) {
    throw new PublisherError(
      `Falha no upload para o YouTube (${upload.status}): ${text.slice(0, 300)}`,
      { retryable: upload.status >= 500 },
    );
  }

  return { externalPostId: json.id, raw: { privacy: "public", bytes: bytes.byteLength } };
}
