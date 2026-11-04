import { z } from "zod";

const statusSchema = z.object({ status: z.enum(["queued", "processing", "completed", "failed"]) });
const jobSchema = z.object({ jobId: z.string().uuid(), status: z.literal("queued") });
const downloadSchema = z.object({
  data: z
    .string()
    .max(11_184_812)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/),
});

/** Local-only development transport. Never exposes the shared secret to the browser. */
export async function callLocalRenderer(
  operation: "jobs" | "status" | "download",
  data: Record<string, string>,
) {
  const secret = process.env.STUDIO_WORKER_SECRET ?? "";
  const rawUrl = process.env.STUDIO_WORKER_URL ?? "";
  if (secret.length < 32 || !/^[\x20-\x7e]+$/.test(secret) || !rawUrl)
    throw new Error("Configure o worker local e STUDIO_WORKER_SECRET no servidor.");
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("STUDIO_WORKER_URL inválida.");
  }
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("O protótipo de renderização exige URL HTTP em localhost.");
  }
  let response: Response;
  try {
    response = await fetch(new URL(`/v1/${operation}`, url), {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(operation === "download" ? 60_000 : 10_000),
    });
  } catch {
    throw new Error("Worker de vídeo indisponível. Verifique se está em execução no servidor.");
  }
  if (response.status === 429) throw new Error("Fila de vídeos cheia. Tente novamente mais tarde.");
  if (response.status === 404) throw new Error("Vídeo não encontrado, não está pronto ou expirou.");
  if (!response.ok)
    throw new Error("O worker de vídeo recusou a operação. Verifique sua configuração.");
  const raw = await response.json();
  if (operation === "jobs") return jobSchema.parse(raw);
  if (operation === "status") return statusSchema.parse(raw);
  return downloadSchema.parse(raw);
}
