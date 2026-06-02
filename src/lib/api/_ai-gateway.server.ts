/**
 * VELT — Lovable AI Gateway helper (server-only)
 * Single source of truth for structured tool-calling against the gateway.
 * The `.server.ts` extension prevents accidental client-side imports.
 */

const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const DEFAULT_AI_MODEL = "google/gemini-3-flash-preview";

export interface CallAIToolArgs {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  parameters: Record<string, unknown>;
  /** Override default model (`google/gemini-3-flash-preview`). */
  model?: string;
}

export interface CallAIToolResult<T> {
  data: T;
  model: string;
}

/**
 * Calls the Lovable AI Gateway with a forced structured tool call and returns
 * the parsed arguments. Throws human-readable errors for the common failure
 * modes (missing key, rate limit, payment required, malformed response).
 */
export async function callAITool<T>(args: CallAIToolArgs): Promise<CallAIToolResult<T>> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    throw new Error("LOVABLE_API_KEY ausente. Configure em Settings → Workspace.");
  }

  const model = args.model ?? DEFAULT_AI_MODEL;

  const body = {
    model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: args.toolName,
          description: args.toolDescription,
          parameters: args.parameters,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: args.toolName } },
  };

  const res = await fetch(LOVABLE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Limite de requisições da IA excedido. Tente novamente em instantes.");
    }
    if (res.status === 402) {
      throw new Error("Créditos da IA esgotados. Adicione em Settings → Workspace → Usage.");
    }
    const txt = await res.text();
    throw new Error(`Falha na IA Gateway (${res.status}): ${txt.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
  };
  const callArgs = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!callArgs) {
    throw new Error("Resposta da IA sem tool call estruturado.");
  }

  return { data: JSON.parse(callArgs) as T, model };
}
