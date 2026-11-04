import { afterEach, describe, expect, it, vi } from "vitest";
import { callLocalRenderer } from "../renderer.server";

const jobId = "c32b66e4-1fc1-4b25-92e7-1b690218f453";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Studio local renderer transport", () => {
  it("fails closed without configuration or for remote hosts", async () => {
    vi.stubEnv("STUDIO_WORKER_SECRET", "");
    vi.stubEnv("STUDIO_WORKER_URL", "");
    await expect(callLocalRenderer("jobs", {})).rejects.toThrow("Configure");
    vi.stubEnv("STUDIO_WORKER_SECRET", "x".repeat(40));
    vi.stubEnv("STUDIO_WORKER_URL", "https://public.example.com");
    await expect(callLocalRenderer("jobs", {})).rejects.toThrow("localhost");
  });
  it("authenticates the server-to-server request and validates worker response", async () => {
    vi.stubEnv("STUDIO_WORKER_SECRET", "x".repeat(40));
    vi.stubEnv("STUDIO_WORKER_URL", "http://127.0.0.1:8765");
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ jobId, status: "queued" }), { status: 202 }),
    );
    vi.stubGlobal("fetch", fetcher);
    expect(await callLocalRenderer("jobs", { title: "Test" })).toEqual({ jobId, status: "queued" });
    const [url, options] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe("http://127.0.0.1:8765/v1/jobs");
    expect(options.headers).toMatchObject({ Authorization: `Bearer ${"x".repeat(40)}` });
  });
  it("fails when the worker returns an invalid response", async () => {
    vi.stubEnv("STUDIO_WORKER_SECRET", "x".repeat(40));
    vi.stubEnv("STUDIO_WORKER_URL", "http://localhost:8765");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ status: "published" }), { status: 200 })),
    );
    await expect(callLocalRenderer("status", { jobId })).rejects.toThrow();
  });
});
