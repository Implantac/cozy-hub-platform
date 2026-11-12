import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publishGoogleBusiness } from "@/lib/scheduler/publishers/google-business.server";
import { PublisherError } from "@/lib/scheduler/contracts";
import type { PublishInput } from "@/lib/scheduler/contracts";

function input(over: Partial<PublishInput> = {}): PublishInput {
  return {
    jobId: "11111111-1111-1111-1111-111111111111",
    workspaceId: "22222222-2222-2222-2222-222222222222",
    channelId: "33333333-3333-3333-3333-333333333333",
    contentId: "44444444-4444-4444-4444-444444444444",
    platform: "google_business",
    payload: {
      title: "Promoção de inverno",
      body: "Café coado + pão na chapa por R$ 12 até sexta. Venha nos visitar.",
      media_urls: [],
    },
    channelConfig: {
      access_token: "tok",
      account_id: "100",
      location_id: "200",
      website: "https://cafedabia.com.br",
    },
    ...over,
  };
}

function mockFetch(impl: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = vi.fn(async (u: string | URL, init?: RequestInit) => {
    const url = String(u);
    calls.push({ url, init });
    const { status, body } = impl(url, init);
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return calls;
}

describe("publishGoogleBusiness", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  let calls: ReturnType<typeof mockFetch>;
  beforeEach(() => {
    calls = mockFetch(() => ({
      status: 200,
      body: { name: "accounts/100/locations/200/localPosts/999", state: "LIVE" },
    }));
  });

  it("posts to the v4 localPosts endpoint with the resolved account and location", async () => {
    const result = await publishGoogleBusiness(input());
    expect(calls[0].url).toBe(
      "https://mybusiness.googleapis.com/v4/accounts/100/locations/200/localPosts",
    );
    expect(result.externalPostId).toBe("accounts/100/locations/200/localPosts/999");
  });

  it("always sends the three fields Google requires: languageCode, summary, callToAction", async () => {
    await publishGoogleBusiness(input());
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.languageCode).toBe("pt-BR");
    expect(body.summary).toContain("Café coado");
    expect(body.callToAction).toEqual({
      actionType: "LEARN_MORE",
      url: "https://cafedabia.com.br",
    });
  });

  it("derives the CTA url from the body when no website is configured", async () => {
    await publishGoogleBusiness(
      input({
        channelConfig: { access_token: "tok", account_id: "100", location_id: "200" },
        payload: { body: "Confira o cardápio em https://cafedabia.com.br/menu hoje." },
      }),
    );
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.callToAction.url).toBe("https://cafedabia.com.br/menu");
  });

  it("never invents an OFFER without the required event schedule", async () => {
    await publishGoogleBusiness(input());
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.topicType).toBe("STANDARD");
    expect(body.offer).toBeUndefined();
  });

  it("classifies a plain post as STANDARD", async () => {
    await publishGoogleBusiness(
      input({ payload: { title: null, body: "Estamos abertos no feriado, das 8h às 14h." } }),
    );
    expect(JSON.parse(String(calls[0].init?.body)).topicType).toBe("STANDARD");
  });

  it("attaches a photo when the media is a public image", async () => {
    await publishGoogleBusiness(
      input({
        payload: {
          title: "x",
          body: "Promoção de inverno com café",
          media_urls: ["https://cdn.x.com/a.jpg"],
        },
      }),
    );
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.media).toEqual([{ mediaFormat: "PHOTO", sourceUrl: "https://cdn.x.com/a.jpg" }]);
  });

  it("rejects a channel without account/location instead of guessing", async () => {
    await expect(
      publishGoogleBusiness(input({ channelConfig: { access_token: "tok" } })),
    ).rejects.toThrow(PublisherError);
    expect(calls).toHaveLength(0); // never reached the network
  });

  it("rejects a channel without a token", async () => {
    await expect(
      publishGoogleBusiness(
        input({ channelConfig: { account_id: "1", location_id: "2", website: "https://a.com" } }),
      ),
    ).rejects.toThrow(/access_token/);
  });

  it("rejects a summary that is too short to be a local post", async () => {
    await expect(
      publishGoogleBusiness(input({ payload: { title: null, body: "oi" } })),
    ).rejects.toThrow(/10 a 1500 caracteres/);
  });

  it("marks a 403 as non-retryable and explains the unverified-location cause", async () => {
    mockFetch(() => ({
      status: 403,
      body: { error: { message: "The caller does not have permission" } },
    }));
    await expect(publishGoogleBusiness(input())).rejects.toMatchObject({ retryable: false });
  });

  it("does not repeat an ambiguous create after an upstream 500", async () => {
    mockFetch(() => ({ status: 500, body: { error: { message: "backend error" } } }));
    await expect(publishGoogleBusiness(input())).rejects.toMatchObject({ retryable: false });
  });

  it("parses account/location from the stored external_id when metadata is absent", async () => {
    calls = mockFetch(() => ({
      status: 200,
      body: { name: "accounts/777/locations/888/localPosts/999", state: "LIVE" },
    }));
    await publishGoogleBusiness(
      input({
        channelConfig: {
          access_token: "tok",
          external_id: "accounts/777/locations/888",
          website: "https://cafedabia.com.br",
        },
      }),
    );
    expect(calls[0].url).toContain("accounts/777/locations/888/localPosts");
  });

  it("uses the CALL action with the configured phone number", async () => {
    await publishGoogleBusiness(
      input({
        channelConfig: {
          access_token: "tok",
          account_id: "100",
          location_id: "200",
          cta_type: "CALL",
          phone: "+55 11 99999-0000",
        },
      }),
    );
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.callToAction).toEqual({ actionType: "CALL" });
  });
  it("uses an explicit offer and serializes the complete Google event schedule", async () => {
    await publishGoogleBusiness(
      input({
        channelConfig: {
          access_token: "tok",
          account_id: "100",
          location_id: "200",
          website: "https://cafedabia.com.br",
          topic_type: "OFFER",
          event_start: "2026-11-13T09:00",
          event_end: "2026-11-14T18:00",
          offer_terms: "Consulte as condições.",
        },
      }),
    );
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.topicType).toBe("OFFER");
    expect(body.event.schedule).toEqual({
      startDate: { year: 2026, month: 11, day: 13 },
      startTime: { hours: 9, minutes: 0, seconds: 0, nanos: 0 },
      endDate: { year: 2026, month: 11, day: 14 },
      endTime: { hours: 18, minutes: 0, seconds: 0, nanos: 0 },
    });
    expect(body.offer.termsConditions).toBe("Consulte as condições.");
    expect(body.offer.terms).toBeUndefined();
    expect(body.callToAction).toBeUndefined();
  });
  it("rejects an OFFER without dates before any network request", async () => {
    await expect(
      publishGoogleBusiness(
        input({
          channelConfig: {
            access_token: "tok",
            account_id: "100",
            location_id: "200",
            topic_type: "OFFER",
          },
        }),
      ),
    ).rejects.toThrow("EVENT/OFFER");
    expect(calls).toHaveLength(0);
  });
  it("allows a standard text post without inventing a Maps place ID or CTA", async () => {
    await publishGoogleBusiness(
      input({ channelConfig: { access_token: "tok", account_id: "100", location_id: "200" } }),
    );
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.callToAction).toBeUndefined();
  });
  it("never labels a policy-rejected resource as published", async () => {
    mockFetch(() => ({
      status: 200,
      body: { name: "accounts/100/locations/200/localPosts/999", state: "REJECTED" },
    }));
    await expect(publishGoogleBusiness(input())).rejects.toMatchObject({
      retryable: false,
      externalPostId: "accounts/100/locations/200/localPosts/999",
    });
  });
  it("checks LIVE after a processing response without repeating create", async () => {
    vi.useFakeTimers();
    let count = 0;
    const network = mockFetch(() => ({
      status: 200,
      body: {
        name: "accounts/100/locations/200/localPosts/999",
        state: ++count === 1 ? "PROCESSING" : "LIVE",
      },
    }));
    const result = publishGoogleBusiness(input());
    await vi.runAllTimersAsync();
    expect((await result).externalPostId).toBe("accounts/100/locations/200/localPosts/999");
    expect(network.map((c) => c.init?.method ?? "GET")).toEqual(["POST", "GET"]);
    vi.useRealTimers();
  });
  it("retains an accepted reference when public status is not confirmed in the bounded polling budget", async () => {
    vi.useFakeTimers();
    const network = mockFetch(() => ({
      status: 200,
      body: { name: "accounts/100/locations/200/localPosts/999", state: "PROCESSING" },
    }));
    const assertion = expect(publishGoogleBusiness(input())).rejects.toMatchObject({
      retryable: false,
      externalPostId: "accounts/100/locations/200/localPosts/999",
    });
    await vi.runAllTimersAsync();
    await assertion;
    expect(network.filter((c) => c.init?.method === "POST")).toHaveLength(1);
    vi.useRealTimers();
  });
  it("rejects a resource belonging to a different unit", async () => {
    mockFetch(() => ({
      status: 200,
      body: { name: "accounts/999/locations/888/localPosts/777", state: "LIVE" },
    }));
    await expect(publishGoogleBusiness(input())).rejects.toThrow("unidade selecionada");
  });
});
