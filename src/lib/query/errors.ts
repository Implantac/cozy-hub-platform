import { errorMessage } from "@/lib/json";

/** A proxy/HTTP failure is not an application-level confirmation of a mutation. */
export class ServerFnHttpError extends Error {
  constructor(readonly status: number) {
    super(`Não foi possível confirmar a operação no servidor (HTTP ${status}). Tente novamente.`);
    this.name = "ServerFnHttpError";
  }
}

/**
 * The Start transport deserializes JSON before checking HTTP status. An upstream
 * 503 returning `{}` could consequently resolve as `undefined` and reach a
 * mutation's success callback. Reject unframed HTTP failures before decoding;
 * serialized application errors still go through Start's own deserializer.
 * Never display an untrusted proxy response body, which may contain internals.
 */
export function checkedServerFnFetch(fetchImpl: typeof globalThis.fetch): typeof globalThis.fetch {
  return async (...args) => {
    const response = await fetchImpl(...args);
    if (!response.ok && response.headers.get("x-tss-serialized") !== "true") {
      throw new ServerFnHttpError(response.status);
    }
    return response;
  };
}

/** Rejections may be strings, JSON, Responses or empty Errors — not just Error. */
export function normalizeMutationError(reason: unknown, fallback: string): Error {
  if (reason instanceof ServerFnHttpError) {
    return new Error(fallback, { cause: reason });
  }
  if (reason instanceof Error && reason.message.trim()) return reason;
  return new Error(errorMessage(reason, fallback), { cause: reason });
}
