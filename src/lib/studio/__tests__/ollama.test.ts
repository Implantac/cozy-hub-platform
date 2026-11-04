import { describe, expect, it, vi } from "vitest";
import { generateWithOllama } from "../ollama.server";

const script = {
  title: "Título",
  hook: "Gancho",
  narration: "Texto",
  scenes: "Cena",
  callToAction: "Ação",
  caption: "Legenda",
};
const config = {
  baseUrl: "http://127.0.0.1:11434",
  model: "modelo-local",
  system: "system",
  user: "brief",
};

describe("Studio local model", () => {
  it("sends structured requests to the configured server and validates output", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: { content: JSON.stringify(script) } }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;
    expect(await generateWithOllama({ ...config, fetcher })).toEqual(script);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, request] = vi.mocked(fetcher).mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:11434/api/chat");
    expect(JSON.parse(String(request?.body))).toMatchObject({
      stream: false,
      model: "modelo-local",
    });
  });
  it("rejects broken output, HTTP failures and invalid configuration without fallback", async () => {
    const bad = vi.fn(
      async () => new Response(JSON.stringify({ message: { content: "{}" } }), { status: 200 }),
    ) as unknown as typeof fetch;
    await expect(generateWithOllama({ ...config, fetcher: bad })).rejects.toThrow("inválido");
    const down = vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    await expect(generateWithOllama({ ...config, fetcher: down })).rejects.toThrow("HTTP 503");
    await expect(
      generateWithOllama({ ...config, baseUrl: "file:///etc/passwd", fetcher: bad }),
    ).rejects.toThrow("URL HTTP");
    await expect(generateWithOllama({ ...config, model: "", fetcher: bad })).rejects.toThrow(
      "MODEL",
    );
  });
});
