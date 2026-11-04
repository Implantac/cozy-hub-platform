import { studioScriptSchema, type StudioScript } from "./schema";

/** Ollama runs on a trusted operator-controlled host, not in the browser. */
export async function generateWithOllama(options: {
  baseUrl: string;
  model: string;
  system: string;
  user: string;
  fetcher?: typeof fetch;
}): Promise<StudioScript> {
  let url: URL;
  try {
    url = new URL(options.baseUrl);
  } catch {
    throw new Error("STUDIO_OLLAMA_URL inválida.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("STUDIO_OLLAMA_URL deve ser uma URL HTTP(S) sem credenciais ou parâmetros.");
  }
  if (!options.model.trim() || options.model.length > 150)
    throw new Error("Configure STUDIO_OLLAMA_MODEL.");
  const response = await (options.fetcher ?? fetch)(new URL("/api/chat", url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: options.model,
      stream: false,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
      format: {
        type: "object",
        properties: Object.fromEntries(
          ["title", "hook", "narration", "scenes", "callToAction", "caption"].map((key) => [
            key,
            { type: "string" },
          ]),
        ),
        required: ["title", "hook", "narration", "scenes", "callToAction", "caption"],
        additionalProperties: false,
      },
      options: { num_predict: 1300 },
    }),
  });
  if (!response.ok)
    throw new Error(
      `Modelo local indisponível (HTTP ${response.status}). Verifique o servidor e o modelo.`,
    );
  let data: unknown;
  try {
    const body = (await response.json()) as { message?: { content?: unknown } };
    if (typeof body.message?.content !== "string" || body.message.content.length > 30000)
      throw new Error();
    data = JSON.parse(body.message.content);
  } catch {
    throw new Error("Resposta inválida do modelo local. Tente novamente.");
  }
  const parsed = studioScriptSchema.safeParse(data);
  if (!parsed.success)
    throw new Error("Roteiro incompleto ou inválido do modelo local. Tente novamente.");
  return parsed.data;
}
