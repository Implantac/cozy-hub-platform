import { isFetchableUrl } from "./media";

export class MediaDownloadError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "MediaDownloadError";
  }
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Downloads a user-supplied media URL with bounded time and memory use.
 * Redirects are deliberately rejected: otherwise a checked public hostname
 * could redirect the server to a private or metadata address.
 *
 * The URL checks block IP literals and common local hostnames. They do not
 * prevent DNS rebinding by themselves; production egress must also deny private,
 * loopback and link-local address ranges.
 */
export async function downloadPublicMedia(
  url: string,
  options: { maxBytes: number; timeoutMs?: number },
): Promise<Uint8Array<ArrayBuffer>> {
  if (!isFetchableUrl(url)) {
    throw new MediaDownloadError("A mídia precisa usar HTTPS e um hostname público válido.", false);
  }
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1) {
    throw new MediaDownloadError("Limite de tamanho inválido para a mídia.", false);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      throw new MediaDownloadError(
        "A URL de mídia redirecionou; redirecionamentos não são aceitos.",
        false,
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new MediaDownloadError(
        `O servidor de mídia respondeu com HTTP ${response.status}.`,
        response.status >= 500 || response.status === 429,
      );
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > options.maxBytes) {
      await response.body?.cancel();
      throw new MediaDownloadError("O arquivo de mídia excede o limite permitido.", false);
    }
    if (!response.body) {
      throw new MediaDownloadError("O servidor de mídia não retornou um arquivo.", false);
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > options.maxBytes) {
          await reader.cancel();
          throw new MediaDownloadError("O arquivo de mídia excede o limite permitido.", false);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const bytes = new Uint8Array(new ArrayBuffer(total));
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch (error) {
    if (error instanceof MediaDownloadError) throw error;
    if (controller.signal.aborted) {
      throw new MediaDownloadError("O download da mídia excedeu o tempo limite.", true);
    }
    throw new MediaDownloadError("Não foi possível baixar a mídia do endereço informado.", true);
  } finally {
    clearTimeout(timeout);
  }
}
