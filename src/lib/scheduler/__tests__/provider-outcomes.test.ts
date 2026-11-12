import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock("../media-download.server", () => ({ downloadPublicMedia: mocks.download }));
import { publishTikTok } from "../publishers/tiktok.server";
import { publishLinkedIn } from "../publishers/linkedin.server";
import type { PublishInput } from "../contracts";

const input = (
  platform: PublishInput["platform"],
  overrides: Partial<PublishInput> = {},
): PublishInput => ({
  jobId: "qa-job",
  workspaceId: "qa-workspace",
  contentId: "qa-content",
  channelId: "qa-channel",
  platform,
  payload: {
    title: "QA title",
    body: "QA body",
    media_urls: platform === "tiktok" ? ["https://cdn.example.com/test.mp4"] : [],
  },
  channelConfig: { access_token: "QA_INVALID_TEST_TOKEN_NEVER_SENT", external_id: "qa-person" },
  ...overrides,
});
const response = (body: unknown, status = 200, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers });

/** Every request/download is intercepted; these tests do NOT connect an account or post. */
describe("real publisher outcome parsing with mocked HTTP", () => {
  beforeEach(() => {
    vi.stubEnv("TIKTOK_DIRECT_POST", "true");
    mocks.download.mockReset().mockResolvedValue(new Uint8Array(8));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("LinkedIn never fabricates a URN from Date.now when the response header is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({}, 201)),
    );
    await expect(publishLinkedIn(input("linkedin"))).rejects.toMatchObject({ retryable: false });
  });
  it("LinkedIn accepts the exact provider-supplied x-restli-id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({}, 201, { "x-restli-id": "urn:li:share:123456789" })),
    );
    await expect(publishLinkedIn(input("linkedin"))).resolves.toEqual({
      externalPostId: "urn:li:share:123456789",
    });
  });
  it("LinkedIn does not retry an ambiguous create failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response({}, 500)),
    );
    await expect(publishLinkedIn(input("linkedin"))).rejects.toMatchObject({ retryable: false });
  });

  function tiktokNetwork(
    statusBody: () => unknown | Response = () => ({
      data: { status: "PUBLISH_COMPLETE", publicaly_available_post_id: ["7654321098765432101"] },
      error: { code: "ok" },
    }),
  ) {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        if (String(url).includes("creator_info/query"))
          return response({
            data: { privacy_level_options: ["PUBLIC_TO_EVERYONE"], comment_disabled: true },
            error: { code: "ok" },
          });
        if (String(url).includes("video/init"))
          return response({
            data: {
              publish_id: "qa-tracking-id",
              upload_url: "https://open-upload.tiktokapis.com/video/?upload_id=qa",
            },
            error: { code: "ok" },
          });
        if (init?.method === "PUT") return new Response(null, { status: 200 });
        const body = statusBody();
        return body instanceof Response ? body : response(body);
      }),
    );
    return calls;
  }
  it("TikTok refuses inbox mode before any upload or external request", async () => {
    const calls = tiktokNetwork();
    await expect(
      publishTikTok(
        input("tiktok", { channelConfig: { access_token: "qa", posting_mode: "inbox" } }),
      ),
    ).rejects.toMatchObject({ retryable: false });
    expect(calls).toHaveLength(0);
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it("TikTok checks creator visibility, uploads and confirms a PUBLIC post ID, not publish_id", async () => {
    const calls = tiktokNetwork();
    const result = await publishTikTok(input("tiktok"));
    expect(result.externalPostId).toBe("7654321098765432101");
    expect(result.raw?.publish_id).toBe("qa-tracking-id");
    expect(calls.map((c) => c.init?.method)).toEqual(["POST", "POST", "PUT", "POST"]);
    const initBody = JSON.parse(String(calls[1].init?.body));
    expect(initBody.post_info.disable_comment).toBe(true);
    expect(initBody.post_info.privacy_level).toBe("PUBLIC_TO_EVERYONE");
  });
  it("TikTok preserves an int64 public ID without JavaScript numeric rounding", async () => {
    tiktokNetwork(
      () =>
        new Response(
          '{"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[7654321098765432101]},"error":{"code":"ok"}}',
        ),
    );
    expect((await publishTikTok(input("tiktok"))).externalPostId).toBe("7654321098765432101");
  });
  it("TikTok refuses a creator for whom public visibility is unavailable", async () => {
    const network = vi.fn(async () =>
      response({ data: { privacy_level_options: ["SELF_ONLY"] }, error: { code: "ok" } }),
    );
    vi.stubGlobal("fetch", network);
    await expect(publishTikTok(input("tiktok"))).rejects.toMatchObject({ retryable: false });
    expect(network).toHaveBeenCalledTimes(1);
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it("TikTok keeps a failed or inbox-delivered reference out of automatic retries", async () => {
    tiktokNetwork(() => ({ data: { status: "SEND_TO_USER_INBOX" }, error: { code: "ok" } }));
    await expect(publishTikTok(input("tiktok"))).rejects.toMatchObject({
      retryable: false,
      externalPostId: "qa-tracking-id",
    });
  });
  it("TikTok never calls a completed-but-not-public reference a successful public post", async () => {
    vi.useFakeTimers();
    const calls = tiktokNetwork(() => ({
      data: { status: "PUBLISH_COMPLETE", publicaly_available_post_id: [] },
      error: { code: "ok" },
    }));
    const assertion = expect(publishTikTok(input("tiktok"))).rejects.toMatchObject({
      retryable: false,
      externalPostId: "qa-tracking-id",
    });
    await vi.runAllTimersAsync();
    await assertion;
    expect(calls.filter((c) => c.url.includes("video/init"))).toHaveLength(1);
  });
  it("TikTok retains the upstream reference after a lost upload acknowledgement", async () => {
    const calls = tiktokNetwork();
    const original = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        if (init?.method === "PUT") throw new TypeError("connection reset");
        return original(url, init);
      }),
    );
    await expect(publishTikTok(input("tiktok"))).rejects.toMatchObject({
      retryable: false,
      externalPostId: "qa-tracking-id",
    });
    expect(calls.filter((c) => c.url.includes("video/init"))).toHaveLength(1);
  });
});
