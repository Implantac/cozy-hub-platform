import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _clearTrustCache } from "@/lib/trust/registry.server";

/**
 * End-to-end dossier tests with the two registries stubbed.
 *
 * The scenarios mirror what actually happens in the wild: a real business, a
 * shell company opened last month, a dead CNPJ, and a registry outage. The last
 * one is the reason this file exists — the product must never turn "consulta
 * falhou" into "empresa suspeita".
 */

const originalFetch = globalThis.fetch;
const NOW = Date.parse("2026-10-28T12:00:00Z");
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

type Handler = (url: string) => { status: number; body: unknown } | "throw";

function stub(handler: Handler) {
  globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    const out = handler(url);
    if (out === "throw") throw new TypeError("network down");
    return new Response(JSON.stringify(out.body), {
      status: out.status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

const GOOD_CNPJ = {
  cnpj: "33000167000101",
  razao_social: "PETROLEO BRASILEIRO S A PETROBRAS",
  nome_fantasia: "PETROBRAS",
  descricao_situacao_cadastral: "ATIVA",
  data_situacao_cadastral: iso(7000),
  data_inicio_atividade: iso(20000),
  porte: "DEMAIS",
  natureza_juridica: "Sociedade de Economia Mista",
  cnae_fiscal_descricao: "Extração de petróleo",
  municipio: "RIO DE JANEIRO",
  uf: "RJ",
  capital_social: 205431960000,
  qsa: [{}, {}, {}],
};

const GOOD_RDAP = {
  ldhName: "petrobras.com.br",
  events: [
    { eventAction: "registration", eventDate: iso(10000) },
    { eventAction: "expiration", eventDate: iso(-1500) },
  ],
  status: ["active"],
};

const { buildDossier } = await import("@/lib/trust/dossier.server");

beforeEach(() => _clearTrustCache());
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("buildDossier — healthy registries", () => {
  it("scores an established company with an old domain as high trust", async () => {
    stub((url) =>
      url.includes("brasilapi")
        ? { status: 200, body: GOOD_CNPJ }
        : { status: 200, body: GOOD_RDAP },
    );

    const d = await buildDossier({
      cnpjDigits: "33000167000101",
      domainHost: "petrobras.com.br",
      now: NOW,
    });

    expect(d.verdict.level).toBe("high");
    expect(d.sources.cnpj).toBe("ok");
    expect(d.sources.domain).toBe("ok");
    expect(d.company?.razaoSocial).toContain("PETROBRAS");
    expect(d.domain?.registeredAt).toBe(iso(10000));
  });

  it("attaches evidence to every scored signal", async () => {
    stub((url) =>
      url.includes("brasilapi")
        ? { status: 200, body: GOOD_CNPJ }
        : { status: 200, body: GOOD_RDAP },
    );
    const d = await buildDossier({ cnpjDigits: "33000167000101", now: NOW });
    const scored = d.verdict.signals.filter((s) => s.weight !== 0);
    expect(scored.length).toBeGreaterThan(0);
    // Every signal that moves the score must be traceable to a fact.
    expect(scored.every((s) => s.source === "cnpj" || s.source === "domain")).toBe(true);
  });
});

describe("buildDossier — shell company", () => {
  it("flags a company opened 20 days ago as low trust", async () => {
    stub((url) =>
      url.includes("brasilapi")
        ? {
            status: 200,
            body: {
              ...GOOD_CNPJ,
              data_inicio_atividade: iso(20),
              capital_social: 0,
              qsa: [],
            },
          }
        : { status: 404, body: "" },
    );

    const d = await buildDossier({
      cnpjDigits: "33000167000101",
      domainHost: "promocao-imperdivel.com.br",
      now: NOW,
    });

    expect(d.verdict.level).toBe("low");
    expect(d.verdict.signals.some((s) => s.id === "cnpj.very-new")).toBe(true);
    expect(d.sources.domain).toBe("not_found");
  });
});

describe("buildDossier — the registry says the CNPJ does not exist", () => {
  it("emits a risk signal when the answer is a real 404", async () => {
    stub((url) =>
      url.includes("brasilapi")
        ? { status: 404, body: { type: "not_found" } }
        : { status: 404, body: "" },
    );
    const d = await buildDossier({ cnpjDigits: "11222333000181", now: NOW });
    expect(d.sources.cnpj).toBe("not_found");
    expect(d.verdict.signals.some((s) => s.id === "cnpj.not-found")).toBe(true);
    expect(d.verdict.level).toBe("low");
  });
});

describe("buildDossier — the registry is down", () => {
  it("never turns an outage into a risk signal", async () => {
    stub(() => "throw");
    const d = await buildDossier({
      cnpjDigits: "33000167000101",
      domainHost: "loja.com.br",
      now: NOW,
    });

    expect(d.sources.cnpj).toBe("unavailable");
    expect(d.sources.domain).toBe("unavailable");
    // The critical assertion: no "cnpj.not-found", no risk derived from silence.
    expect(d.verdict.signals.some((s) => s.id === "cnpj.not-found")).toBe(false);
    expect(d.verdict.signals.some((s) => s.level === "risk")).toBe(false);
    expect(d.verdict.level).toBe("insufficient");
  });

  it("says in plain words that absence of data is not evidence of risk", async () => {
    stub(() => "throw");
    const d = await buildDossier({ cnpjDigits: "33000167000101", now: NOW });
    expect(d.sources.notes.join(" ")).toContain("não é sinal de risco");
  });
});

describe("buildDossier — invalid input", () => {
  it("marks a rejected CNPJ as invalid without querying anything", async () => {
    let queried = false;
    stub(() => {
      queried = true;
      return { status: 200, body: {} };
    });

    const d = await buildDossier({ cnpjInvalid: "checksum", now: NOW });
    expect(d.sources.cnpj).toBe("invalid");
    expect(queried).toBe(false);
    expect(d.verdict.level).toBe("insufficient");
  });

  it("returns insufficient when nothing verifiable was provided", async () => {
    stub(() => ({ status: 200, body: {} }));
    const d = await buildDossier({ now: NOW });
    expect(d.verdict.level).toBe("insufficient");
    expect(d.company).toBeNull();
    expect(d.domain).toBeNull();
  });
});

describe("buildDossier — timestamps", () => {
  it("records when the external data was read", async () => {
    stub((url) =>
      url.includes("brasilapi") ? { status: 200, body: GOOD_CNPJ } : { status: 404, body: "" },
    );
    const d = await buildDossier({ cnpjDigits: "33000167000101", now: NOW });
    // Staleness has to be visible: registry data is not live.
    expect(d.fetchedAt).toBe(new Date(NOW).toISOString());
  });
});
