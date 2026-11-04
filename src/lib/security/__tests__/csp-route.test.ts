import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => ({ insert: mocks.insert }) },
}));

import { Route } from "@/routes/api/csp-report";

type PostHandler = (args: { request: Request }) => Promise<Response>;
const post = (Route.options as unknown as { server: { handlers: { POST: PostHandler } } }).server
  .handlers.POST;

function reportRequest() {
  return new Request("https://velt.app/api/csp-report", {
    method: "POST",
    headers: { "content-type": "application/csp-report", "cf-connecting-ip": "127.0.0.19" },
    body: JSON.stringify({
      "csp-report": {
        "document-uri": "https://velt.app/?secret=hidden",
        "effective-directive": "script-src-elem",
        "blocked-uri": "inline",
      },
    }),
  });
}

describe("CSP collector route", () => {
  beforeEach(() => mocks.insert.mockReset());

  it("writes a valid row without passing a string to the UUID resource_id", async () => {
    mocks.insert.mockResolvedValue({ error: null });
    const response = await post({ request: reportRequest() });
    expect(response.status).toBe(204);
    const [row] = mocks.insert.mock.calls[0][0];
    expect(row).not.toHaveProperty("resource_id");
    expect(row.metadata).toMatchObject({
      effectiveDirective: "script-src-elem",
      documentURI: "https://velt.app/",
    });
  });

  it("returns 500 when database writes fail rather than claiming reports were collected", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "database unavailable" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await post({ request: reportRequest() })).status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});
