import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _clearTrustCache,
  eventsOf,
  lookupCnpj,
  lookupDomain,
  type RdapResponse,
} from "@/lib/trust/registry.server";

/**
 * The failure modes here are the interesting ones. BrasilAPI has no SLA and is
 * run by volunteers; the contract this module must honour is that *any* failure
 * on their side is reported as "unavailable", never as a fact about the company.
 */

const originalFetch = globalThis.fetch;
let calls: string[] = [];

function stubFetch(
  handler: (url: string) => { status: number; body: unknown } | "throw" | "abort",
) {
  calls = [];
  globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push(url);
    const out = handler(url);
    if (out === "throw") throw new TypeError("network down");
    if (out === "abort") {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }
    return new Response(JSON.stringify(out.body), {
      status: out.status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

beforeEach(() => _clearTrustCache());
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("lookupCnpj", () => {
  it("returns the company on 200", async () => {
    stubFetch(() => ({
      status: 200,
      body: {
        cnpj: "33000167000101",
        razao_social: "PETROBRAS",
        descricao_situacao_cadastral: "ATIVA",
      },
    }));

    const r = await lookupCnpj("33000167000101");
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.data.razao_social).toBe("PETROBRAS");
  });

  it("returns not_found on 404 — the CNPJ does not exist", async () => {
    stubFetch(() => ({ status: 404, body: { type: "not_found", message: "não encontrado" } }));
    expect((await lookupCnpj("00000000000000")).status).toBe("not_found");
  });

  it("reports unavailable — never not_found — when the network fails", async () => {
    stubFetch(() => "throw");
    const r = await lookupCnpj("33000167000101");
    // This is the whole point: an outage must not read as "company does not exist".
    expect(r.status).toBe("unavailable");
  });

  it("reports unavailable on timeout", async () => {
    stubFetch(() => "abort");
    expect((await lookupCnpj("33000167000101")).status).toBe("unavailable");
  });

  it("reports unavailable on 429 instead of pretending it checked", async () => {
    stubFetch(() => ({ status: 429, body: { message: "too many requests" } }));
    const r = await lookupCnpj("33000167000101");
    expect(r.status).toBe("unavailable");
    if (r.status === "unavailable") expect(r.reason).toContain("limite");
  });

  it("does not cache failures: the next visit retries", async () => {
    stubFetch(() => "throw");
    await lookupCnpj("33000167000101");
    expect(calls).toHaveLength(1);
    await lookupCnpj("33000167000101");
    expect(calls).toHaveLength(2);
  });

  it("caches successes so a page reload does not hit the volunteer API again", async () => {
    stubFetch(() => ({ status: 200, body: { cnpj: "1", razao_social: "X" } }));
    await lookupCnpj("33000167000101");
    await lookupCnpj("33000167000101");
    await lookupCnpj("33000167000101");
    expect(calls).toHaveLength(1);
  });
});

describe("lookupDomain", () => {
  it("queries the registrable domain, not the subdomain", async () => {
    stubFetch(() => ({ status: 200, body: { ldhName: "loja.com.br" } }));
    await lookupDomain("www.loja.com.br");
    expect(calls[0]).toContain("/domain/loja.com.br");
  });

  it("returns not_found for an unregistered domain", async () => {
    stubFetch(() => ({ status: 404, body: "" }));
    expect((await lookupDomain("nao-existe-abc123.com.br")).status).toBe("not_found");
  });

  it("reports unavailable on a registry error", async () => {
    stubFetch(() => ({ status: 500, body: {} }));
    expect((await lookupDomain("loja.com.br")).status).toBe("unavailable");
  });
});

describe("eventsOf", () => {
  it("extracts the three dates RDAP exposes", () => {
    const rdap: RdapResponse = {
      ldhName: "petrobras.com.br",
      events: [
        { eventAction: "registration", eventDate: "1996-06-14T12:00:00Z" },
        { eventAction: "last changed", eventDate: "2025-07-11T14:35:30Z" },
        { eventAction: "expiration", eventDate: "2030-06-14T12:00:00Z" },
      ],
    };
    const e = eventsOf(rdap);
    expect(e.registeredAt).toBe("1996-06-14T12:00:00Z");
    expect(e.expiresAt).toBe("2030-06-14T12:00:00Z");
  });

  it("returns nulls rather than throwing when the registry omits events", () => {
    const e = eventsOf({ ldhName: "x.com" });
    expect(e).toEqual({ registeredAt: null, expiresAt: null, updatedAt: null });
  });

  it("is case-insensitive about event action names", () => {
    const e = eventsOf({ events: [{ eventAction: "Registration", eventDate: "2020-01-01" }] });
    expect(e.registeredAt).toBe("2020-01-01");
  });
});
