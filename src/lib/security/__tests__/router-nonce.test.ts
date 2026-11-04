import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequest: vi.fn(),
  createRouter: vi.fn((options: unknown) => ({ options })),
}));

vi.mock("@/routeTree.gen", () => ({ routeTree: {} }));
vi.mock("@tanstack/react-router", () => ({ createRouter: mocks.createRouter }));
vi.mock("@tanstack/react-start", () => ({
  // Match the framework's browser behavior: a server-only function throws if
  // the client accidentally invokes it, instead of silently returning null.
  createServerOnlyFn: (fn: () => unknown) => () => {
    if (typeof window !== "undefined") throw new Error("server-only function called in browser");
    return fn();
  },
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: mocks.getRequest }));

import { getRouter } from "@/router";
import { nonceForRequest } from "@/lib/security/headers";

describe("request-scoped router nonce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("constructs the browser router without calling the server-only function", () => {
    vi.stubGlobal("window", {});
    expect(() => getRouter()).not.toThrow();
    expect(mocks.getRequest).not.toHaveBeenCalled();
    expect(mocks.createRouter.mock.calls[0][0]).not.toHaveProperty("ssr.nonce");
  });

  it("uses the request nonce for SSR", () => {
    const request = new Request("https://velt.app/");
    mocks.getRequest.mockReturnValue(request);
    getRouter();
    expect(mocks.createRouter.mock.calls[0][0]).toHaveProperty(
      "ssr.nonce",
      nonceForRequest(request),
    );
  });
});
