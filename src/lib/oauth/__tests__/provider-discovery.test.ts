import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { getProvider, listBusinessLocations } from "../providers.server";
const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  for (const name of [
    "META_APP_ID",
    "META_APP_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "LINKEDIN_CLIENT_ID",
    "LINKEDIN_CLIENT_SECRET",
  ])
    vi.stubEnv(name, "unit-test-only");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const args = {
  code: "unit-code",
  redirectUri: "https://velt.example/api/public/oauth/callback/test",
};
describe("resource discovery contracts (network fully mocked)", () => {
  it("encryptable Meta credential is the Page token, never the user token or public metadata", async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: "user-secret" })).mockResolvedValueOnce(
      json({
        data: [
          {
            id: "page",
            name: "The Page",
            access_token: "page-secret",
            instagram_business_account: { id: "ig", username: "ig-name" },
          },
        ],
      }),
    );
    const result = await getProvider("instagram").exchange(args);
    expect(result).toMatchObject({
      accessToken: "page-secret",
      externalAccountId: "ig",
      metadata: { page_id: "page", ig_user_id: "ig" },
    });
    expect(JSON.stringify(result.metadata)).not.toContain("secret");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v24.0/");
  });
  it("rejects ambiguous Meta account selection instead of publishing to the first Page", async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: "user" })).mockResolvedValueOnce(
      json({
        data: [
          { id: "a", access_token: "a" },
          { id: "b", access_token: "b" },
        ],
      }),
    );
    await expect(getProvider("facebook").exchange(args)).rejects.toMatchObject({
      code: "account_selection_required",
    });
  });
  it("does not treat a missing Instagram business account as a connected publishing resource", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: "user" }))
      .mockResolvedValueOnce(json({ data: [{ id: "page", access_token: "token" }] }));
    await expect(getProvider("instagram").exchange(args)).rejects.toMatchObject({
      code: "no_eligible_account",
    });
  });
  it("discovers the real YouTube channel ID after token exchange", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: "youtube" }))
      .mockResolvedValueOnce(
        json({ items: [{ id: "channel-real", snippet: { title: "The Channel" } }] }),
      );
    expect(await getProvider("youtube").exchange(args)).toMatchObject({
      externalAccountId: "channel-real",
      externalHandle: "The Channel",
    });
  });
  it("discovers the LinkedIn author instead of fabricating an OAuth timestamp identity", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: "linkedin" }))
      .mockResolvedValueOnce(json({ sub: "person-real", name: "Person" }));
    expect(await getProvider("linkedin").exchange(args)).toMatchObject({
      externalAccountId: "person-real",
      metadata: { person_id: "person-real" },
    });
  });
  it("uses VoiceOfMerchant, not location existence or canOperateLocalServices, as the verification gate", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ accounts: [{ name: "accounts/a" }] }))
      .mockResolvedValueOnce(
        json({
          locations: [
            {
              name: "locations/one",
              title: "Same name",
              metadata: { canOperateLocalServices: true },
            },
            { name: "locations/two", title: "Same name" },
          ],
        }),
      )
      .mockResolvedValueOnce(json({ hasVoiceOfMerchant: false }))
      .mockResolvedValueOnce(json({ hasVoiceOfMerchant: true }));
    const rows = await listBusinessLocations("unit-token");
    expect(rows.map((r) => [r.name, r.verified])).toEqual([
      ["accounts/a/locations/one", false],
      ["accounts/a/locations/two", true],
    ]);
    expect(String(fetchMock.mock.calls[2][0])).toContain("/locations/one/VoiceOfMerchantState");
  });
  it("paginates both GBP accounts and locations rather than silently losing branches", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ accounts: [{ name: "accounts/a" }], nextPageToken: "accounts-next" }),
      )
      .mockResolvedValueOnce(json({ accounts: [] }))
      .mockResolvedValueOnce(
        json({ locations: [{ name: "locations/one" }], nextPageToken: "locations-next" }),
      )
      .mockResolvedValueOnce(json({ hasVoiceOfMerchant: true }))
      .mockResolvedValueOnce(json({ locations: [{ name: "locations/two" }] }))
      .mockResolvedValueOnce(json({ hasVoiceOfMerchant: true }));
    expect(await listBusinessLocations("unit-token")).toHaveLength(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("pageToken=accounts-next");
    expect(String(fetchMock.mock.calls[4][0])).toContain("pageToken=locations-next");
  });
  it("does not silently return a partial/empty GBP list when a provider read fails", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ accounts: [{ name: "accounts/a" }] }))
      .mockResolvedValueOnce(json({ error: "upstream-sensitive-body" }, 403));
    await expect(listBusinessLocations("unit-token")).rejects.toMatchObject({
      code: "provider_unavailable",
    });
  });
  it("does not automatically bind the first GBP branch after OAuth", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ access_token: "google" }))
      .mockResolvedValueOnce(json({ accounts: [{ name: "accounts/a" }] }))
      .mockResolvedValueOnce(json({ locations: [{ name: "locations/one", title: "One" }] }))
      .mockResolvedValueOnce(json({ hasVoiceOfMerchant: true }));
    expect(await getProvider("google_business").exchange(args)).toMatchObject({
      externalAccountId: "accounts/a",
      metadata: { requires_location_selection: true, location_confirmed: false },
    });
  });
});
