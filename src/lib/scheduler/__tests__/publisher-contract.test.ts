import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock("../publishers/meta.server", () => ({
  publishFacebook: mocks.publish,
  publishInstagram: mocks.publish,
}));
vi.mock("../publishers/youtube.server", () => ({ publishYouTube: mocks.publish }));
vi.mock("../publishers/linkedin.server", () => ({ publishLinkedIn: mocks.publish }));
vi.mock("../publishers/tiktok.server", () => ({ publishTikTok: mocks.publish }));
vi.mock("../publishers/google-business.server", () => ({
  publishGoogleBusiness: mocks.publish,
  googleBusinessPostBody: vi.fn(),
}));
import { preflightOrThrow, publishToPlatform, publisherCapabilities } from "../publishers.server";
import { PublisherError, type PublishInput } from "../contracts";

const input = (overrides: Partial<PublishInput> = {}): PublishInput => ({
  jobId: "qa-job",
  workspaceId: "qa-workspace",
  contentId: "qa-content",
  channelId: "qa-channel",
  platform: "facebook",
  payload: { title: "QA title", body: "QA body" },
  channelConfig: { access_token: "QA_TEST_TOKEN_NEVER_SENT" },
  ...overrides,
});

describe("publisher contract — all providers mocked, no homologation", () => {
  beforeEach(() => {
    mocks.publish.mockReset().mockResolvedValue({ externalPostId: "qa-confirmed-id" });
    vi.stubEnv("VELT_PUBLISHER_MODE", "real");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    undefined,
    null,
    {},
    { externalPostId: "" },
    { externalPostId: "   " },
    { externalPostId: "sim_fake" },
  ])("never accepts an unconfirmed provider result %j", async (value) => {
    mocks.publish.mockResolvedValue(value);
    await expect(publishToPlatform(input())).rejects.toMatchObject({ retryable: false });
  });
  it("returns an actual supplied provider ID without fabricating one", async () => {
    await expect(publishToPlatform(input())).resolves.toEqual({
      externalPostId: "qa-confirmed-id",
    });
  });
  it("does not automatically retry an ambiguous network exception", async () => {
    mocks.publish.mockRejectedValue(new TypeError("fetch failed"));
    await expect(publishToPlatform(input())).rejects.toMatchObject({ retryable: false });
  });
  it("preserves an upstream reference and non-retryability when confirmation is pending", async () => {
    mocks.publish.mockRejectedValue(
      new PublisherError("Not yet public", {
        retryable: false,
        externalPostId: "qa-tracking-reference",
      }),
    );
    await expect(publishToPlatform(input())).rejects.toMatchObject({
      retryable: false,
      externalPostId: "qa-tracking-reference",
    });
  });
  it("redacts the private token before an upstream error reaches logs or persistence", async () => {
    mocks.publish.mockRejectedValue(
      new PublisherError("Rejected token QA_TEST_TOKEN_NEVER_SENT", { retryable: false }),
    );
    await expect(publishToPlatform(input())).rejects.toThrow("Rejected token [redacted]");
  });
  it("rejects simulated publication in a production runtime", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VELT_PUBLISHER_MODE", "simulate");
    await expect(publishToPlatform(input())).rejects.toMatchObject({ retryable: false });
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("retains explicitly identified simulation only in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VELT_PUBLISHER_MODE", "simulate");
    expect((await publishToPlatform(input())).externalPostId).toMatch(/^sim_/);
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("does not silently discard all but the first attachment", () => {
    expect(() =>
      preflightOrThrow(
        input({
          payload: {
            title: "QA",
            media_urls: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
          },
        }),
      ),
    ).toThrow("carrossel");
  });
  it.each(["youtube", "tiktok"] as const)("requires a real video URL for %s", (platform) => {
    expect(() =>
      preflightOrThrow(
        input({
          platform,
          payload: { title: "QA", media_urls: ["https://cdn.example.com/a.jpg"] },
        }),
      ),
    ).toThrow("vídeo");
  });
  it("rejects LinkedIn video before allocating an upload or queueing a job", () => {
    expect(() =>
      preflightOrThrow(
        input({
          platform: "linkedin",
          payload: { title: "QA", media_urls: ["https://cdn.example.com/a.mp4"] },
        }),
      ),
    ).toThrow("não está implementado");
  });
  it("rejects an overlong YouTube title rather than truncating it", () => {
    expect(() =>
      preflightOrThrow(
        input({
          platform: "youtube",
          payload: { title: "a".repeat(101), media_urls: ["https://cdn.example.com/a.mp4"] },
        }),
      ),
    ).toThrow("100");
  });
  it("does not schedule a TikTok inbox draft as a publication", () => {
    expect(() =>
      preflightOrThrow(
        input({
          platform: "tiktok",
          channelConfig: { posting_mode: "inbox" },
          payload: { title: "QA", media_urls: ["https://cdn.example.com/a.mp4"] },
        }),
      ),
    ).toThrow("não é publicação");
  });
  it("keeps TikTok configuration unready until Direct Post is explicitly enabled", () => {
    vi.stubEnv("TIKTOK_CLIENT_KEY", "qa");
    vi.stubEnv("TIKTOK_CLIENT_SECRET", "qa");
    vi.stubEnv("TIKTOK_DIRECT_POST", "false");
    expect(publisherCapabilities().find((c) => c.platform === "tiktok")).toMatchObject({
      implemented: true,
      credentialsReady: false,
      missingEnv: ["TIKTOK_DIRECT_POST=true"],
    });
  });
});
