import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadPublicMedia } from "../media-download.server";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("downloadPublicMedia", () => {
  it("downloads a bounded HTTPS asset without following redirects", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetchMock);

    const bytes = await downloadPublicMedia("https://cdn.example.com/video.mp4", {
      maxBytes: 10,
    });

    expect([...bytes]).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cdn.example.com/video.mp4",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("rejects local or IP-literal destinations before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      downloadPublicMedia("https://127.0.0.1/video.mp4", { maxBytes: 100 }),
    ).rejects.toThrow(/hostname público/i);
    await expect(
      downloadPublicMedia("https://media.internal/video.mp4", { maxBytes: 100 }),
    ).rejects.toThrow(/hostname público/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects redirects so a public URL cannot redirect to an internal target", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(null, { status: 302, headers: { location: "https://127.0.0.1/secret" } }),
      ),
    );

    await expect(
      downloadPublicMedia("https://cdn.example.com/video.mp4", { maxBytes: 100 }),
    ).rejects.toThrow(/redirecionou/i);
  });

  it("rejects an oversized Content-Length before reading the body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            headers: { "content-length": "1024" },
          }),
      ),
    );

    await expect(
      downloadPublicMedia("https://cdn.example.com/video.mp4", { maxBytes: 10 }),
    ).rejects.toThrow(/excede o limite/i);
  });

  it("enforces the byte limit while streaming when Content-Length is absent", async () => {
    let canceled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(6));
        controller.enqueue(new Uint8Array(6));
      },
      cancel() {
        canceled = true;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body)),
    );

    await expect(
      downloadPublicMedia("https://cdn.example.com/video.mp4", { maxBytes: 10 }),
    ).rejects.toThrow(/excede o limite/i);
    expect(canceled).toBe(true);
  });
});
