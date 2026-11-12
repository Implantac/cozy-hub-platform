import { describe, expect, it, vi } from "vitest";
import { checkedServerFnFetch, normalizeMutationError, ServerFnHttpError } from "../errors";

const fallback = "Não foi possível confirmar a alteração. Verifique o estado atual.";

describe("server-function HTTP integrity", () => {
  it.each([401, 403, 429, 500, 502, 503])(
    "rejects an unframed HTTP %i even when its body is JSON",
    async (status) => {
      const fetchImpl = vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(Response.json({}, { status }));
      const promise = checkedServerFnFetch(fetchImpl)("https://app.example/_serverFn/test");
      await expect(promise).rejects.toBeInstanceOf(ServerFnHttpError);
      await expect(promise).rejects.toMatchObject({ status });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it("never displays a proxy error body or treats it as an application result", async () => {
    const fetchImpl = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        Response.json({ internal_secret: "QA_NOT_A_REAL_SECRET" }, { status: 503 }),
      );
    const error = await checkedServerFnFetch(fetchImpl)("https://app.example/_serverFn/test").catch(
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain("QA_NOT_A_REAL_SECRET");
    expect(normalizeMutationError(error, fallback).message).toBe(fallback);
  });

  it("leaves serialized application errors to the framework decoder without consuming the body", async () => {
    const response = Response.json(
      { error: "serialized application error" },
      {
        status: 403,
        headers: { "x-tss-serialized": "true" },
      },
    );
    const fetchImpl = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
    expect(await checkedServerFnFetch(fetchImpl)("https://app.example/_serverFn/test")).toBe(
      response,
    );
    expect(response.bodyUsed).toBe(false);
  });

  it("forwards auth, method, payload and AbortSignal and does not modify successful responses", async () => {
    const response = Response.json(
      { result: { id: "synthetic-id" } },
      {
        headers: { "x-tss-serialized": "true" },
      },
    );
    const fetchImpl = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
    const controller = new AbortController();
    const init = {
      method: "POST",
      headers: { Authorization: "Bearer QA_INVALID" },
      body: "{}",
      signal: controller.signal,
    };
    expect(await checkedServerFnFetch(fetchImpl)("https://app.example/_serverFn/test", init)).toBe(
      response,
    );
    expect(fetchImpl).toHaveBeenCalledWith("https://app.example/_serverFn/test", init);
    expect(response.bodyUsed).toBe(false);
  });

  it("propagates a native network rejection without retrying a possibly applied mutation", async () => {
    const reason = new TypeError("Failed to fetch");
    const fetchImpl = vi.fn<typeof globalThis.fetch>().mockRejectedValue(reason);
    await expect(
      checkedServerFnFetch(fetchImpl)("https://app.example/_serverFn/test"),
    ).rejects.toBe(reason);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("mutation errors are visible and truthful", () => {
  it.each([
    null,
    undefined,
    {},
    [],
    42,
    "",
    "  ",
    new Error(""),
    new Error("  "),
    new Response(null, { status: 503 }),
  ])("normalizes the rejection %j to a nonempty Error", (reason) => {
    const error = normalizeMutationError(reason, fallback);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(fallback);
    expect(error.cause).toBe(reason);
  });

  it("recovers thrown strings and JSON error messages", () => {
    expect(normalizeMutationError("Operation denied", fallback).message).toBe("Operation denied");
    expect(normalizeMutationError({ error: "Operation denied" }, fallback).message).toBe(
      "Operation denied",
    );
    expect(normalizeMutationError({ message: "Operation denied" }, fallback).message).toBe(
      "Operation denied",
    );
  });

  it("preserves an application's real Error, including its details and cause", () => {
    const reason = new Error("Cancel the active schedule first.", { cause: "23514" });
    expect(normalizeMutationError(reason, fallback)).toBe(reason);
  });

  it("uses the calling component's language for an unconfirmed HTTP operation", () => {
    const reason = new ServerFnHttpError(503);
    const english =
      "The change could not be confirmed. Check the current state before repeating the action.";
    const error = normalizeMutationError(reason, english);
    expect(error.message).toBe(english);
    expect(error.cause).toBe(reason);
  });
});
