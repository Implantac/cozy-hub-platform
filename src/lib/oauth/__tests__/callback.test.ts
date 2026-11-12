import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  exchange: vi.fn(),
  getProvider: vi.fn(),
  role: "admin" as string | null,
  brand: true,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: mocks.from, rpc: mocks.rpc },
}));
vi.mock("../providers.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../providers.server")>();
  return { ...actual, getProvider: mocks.getProvider };
});
import { signState, stateCookieName, stateCookieValue } from "../state.server";
import { decryptToken } from "../crypto.server";
import { ProviderConnectionError } from "../providers.server";
import { handleOAuthCallback } from "../callback.server";
const ws = "10000000-0000-4000-8000-000000000001",
  user = "10000000-0000-4000-8000-000000000002",
  brand = "10000000-0000-4000-8000-000000000003";
function request(
  opts: {
    cookie?: boolean;
    provider?: string;
    error?: string;
    brandId?: string;
    code?: string;
  } = {},
) {
  const provider = opts.provider ?? "facebook";
  const state = signState({
    workspaceId: ws,
    userId: user,
    provider,
    brandId: opts.brandId,
    redirectUri: `https://velt.example/api/public/oauth/callback/${provider}`,
  });
  const url = new URL(`https://velt.example/api/public/oauth/callback/${provider}`);
  url.searchParams.set("state", state);
  if (opts.error) url.searchParams.set("error", opts.error);
  else url.searchParams.set("code", opts.code ?? "authorization-code");
  return new Request(url, {
    headers:
      opts.cookie === false
        ? {}
        : { cookie: `${stateCookieName(provider)}=${stateCookieValue(state)}` },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_ORIGIN", "https://velt.example");
  vi.stubEnv("OAUTH_TOKEN_ENC_KEY", Buffer.alloc(32, 8).toString("base64"));
  mocks.role = "admin";
  mocks.brand = true;
  mocks.from.mockImplementation((table: string) => {
    const q: Record<string, unknown> = {};
    for (const key of ["select", "eq"]) q[key] = () => q;
    q.maybeSingle = async () => ({
      data:
        table === "workspace_members"
          ? mocks.role
            ? { role: mocks.role }
            : null
          : mocks.brand
            ? { id: brand }
            : null,
      error: null,
    });
    return q;
  });
  mocks.exchange.mockResolvedValue({
    accessToken: "unit-access-secret",
    refreshToken: "unit-refresh-secret",
    externalAccountId: "page-123",
    metadata: { page_id: "page-123" },
  });
  mocks.getProvider.mockReturnValue({ platform: "facebook", exchange: mocks.exchange });
  mocks.rpc.mockResolvedValue({
    data: { id: "channel", workspace_id: ws, status: "connected" },
    error: null,
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("OAuth callback fail-closed transaction boundary (mock providers, not external homologation)", () => {
  it("requires the initiating browser before touching the provider or database", async () => {
    expect((await handleOAuthCallback(request({ cookie: false }), "facebook")).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects a different provider and untrusted/modified state", async () => {
    const req = request();
    expect((await handleOAuthCallback(req, "instagram")).status).toBe(400);
    const url = new URL(req.url);
    url.searchParams.set("state", url.searchParams.get("state") + "x");
    expect(
      (await handleOAuthCallback(new Request(url, { headers: req.headers }), "facebook")).status,
    ).toBe(400);
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it.each([null, "viewer", "editor"])(
    "rechecks the current role (%s) before token exchange",
    async (role) => {
      mocks.role = role;
      const response = await handleOAuthCallback(request(), "facebook");
      expect(response.headers.get("location")).toContain("oauth_error=connection_failed");
      expect(mocks.exchange).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it("rejects a removed/foreign brand before token exchange", async () => {
    mocks.brand = false;
    await handleOAuthCallback(request({ brandId: brand }), "facebook");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it("handles provider denial only after validating browser/state, without reflecting provider text", async () => {
    const response = await handleOAuthCallback(
      request({ error: "secret-provider-error" }),
      "facebook",
    );
    expect(response.headers.get("location")).toBe(
      "https://velt.example/app/channels?oauth_error=provider_denied",
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it("persists only ciphertext through a single atomic RPC, then redirects to Channels", async () => {
    const response = await handleOAuthCallback(request(), "facebook");
    const [name, args] = mocks.rpc.mock.calls[0];
    expect(name).toBe("complete_oauth_connection");
    expect(args).toMatchObject({
      _workspace_id: ws,
      _actor_id: user,
      _external_id: "page-123",
      _platform: "facebook",
    });
    expect(decryptToken(args._access_ciphertext)).toBe("unit-access-secret");
    expect(decryptToken(args._refresh_ciphertext)).toBe("unit-refresh-secret");
    expect(JSON.stringify(args._metadata)).not.toContain("secret");
    expect(args._metadata).toMatchObject({ page_id: "page-123" });
    expect(response.headers.get("location")).toBe(
      "https://velt.example/app/channels?oauth_connected=facebook",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });
  it.each([
    { accessToken: "x" },
    { externalAccountId: "id" },
    { accessToken: " ", externalAccountId: "id" },
  ])(
    "does not invent an external identity or report a missing credential as connected: %j",
    async (tokens) => {
      mocks.exchange.mockResolvedValue(tokens);
      const response = await handleOAuthCallback(request(), "facebook");
      expect(response.headers.get("location")).toContain("oauth_error=connection_failed");
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );
  it.each([
    { data: null, error: { message: "revoked during exchange" } },
    { data: null, error: null },
    { data: { workspace_id: "other", status: "connected" }, error: null },
  ])("does not report a failed or mismatched commit as success: %j", async (result) => {
    mocks.rpc.mockResolvedValue(result);
    const response = await handleOAuthCallback(request(), "facebook");
    expect(response.headers.get("location")).toContain("oauth_error=connection_failed");
  });
  it("returns only a whitelisted, actionable discovery failure code", async () => {
    mocks.exchange.mockRejectedValue(new ProviderConnectionError("account_selection_required"));
    const response = await handleOAuthCallback(request(), "facebook");
    expect(response.headers.get("location")).toContain("oauth_error=account_selection_required");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not select a GBP location implicitly", async () => {
    mocks.getProvider.mockReturnValue({ platform: "google_business", exchange: mocks.exchange });
    mocks.exchange.mockResolvedValue({
      accessToken: "unit-only",
      externalAccountId: "accounts/a",
      metadata: { location_confirmed: false, requires_location_selection: true },
    });
    await handleOAuthCallback(request({ provider: "google_business" }), "google_business");
    expect(mocks.rpc.mock.calls[0][1]._metadata).toMatchObject({
      location_confirmed: false,
      requires_location_selection: true,
    });
    expect(mocks.rpc.mock.calls[0][1]._metadata.location_id).toBeUndefined();
  });
});
