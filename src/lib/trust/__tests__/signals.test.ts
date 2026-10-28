import { describe, expect, it } from "vitest";
import {
  evaluateCnpjDomainMatch,
  evaluateCompany,
  evaluateDomain,
  parseCnpj,
  parseDomain,
  registrableDomain,
  scoreTrust,
  type CompanyFacts,
  type DomainFacts,
} from "@/lib/trust/signals";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

function company(over: Partial<CompanyFacts> = {}): CompanyFacts {
  return {
    cnpj: "33.000.167/0001-01",
    razaoSocial: "PETROLEO BRASILEIRO S A PETROBRAS",
    nomeFantasia: "PETROBRAS",
    situacao: "ATIVA",
    dataSituacao: iso(7000),
    dataAbertura: iso(20000),
    porte: "DEMAIS",
    naturezaJuridica: "Sociedade de Economia Mista",
    cnae: "Extração de petróleo",
    municipio: "RIO DE JANEIRO",
    uf: "RJ",
    capitalSocial: 205431960000,
    mei: false,
    simples: false,
    socios: 8,
    ...over,
  };
}

function domain(over: Partial<DomainFacts> = {}): DomainFacts {
  return {
    host: "petrobras.com.br",
    registeredAt: iso(10000),
    expiresAt: iso(-1500), // 1500 days in the future
    updatedAt: iso(100),
    statuses: ["active"],
    ...over,
  };
}

describe("parseCnpj — checksum, not regex", () => {
  it("accepts a real CNPJ in any formatting", () => {
    for (const raw of ["33000167000101", "33.000.167/0001-01", " 33 000 167 0001 01 "]) {
      const r = parseCnpj(raw);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.digits).toBe("33000167000101");
    }
  });

  it("rejects a CNPJ that has the right shape but wrong check digits", () => {
    // This is the case a regex cannot catch, and the reason this function exists.
    const r = parseCnpj("11.222.333/0001-00");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("checksum");
  });

  it("names each failure instead of a generic error", () => {
    expect(parseCnpj("")).toEqual({ ok: false, reason: "empty" });
    expect(parseCnpj("123")).toEqual({ ok: false, reason: "length" });
    expect(parseCnpj("00000000000000")).toEqual({ ok: false, reason: "repeated" });
  });

  it("formats for display", () => {
    const r = parseCnpj("33000167000101");
    if (r.ok) expect(r.formatted).toBe("33.000.167/0001-01");
  });
});

describe("parseDomain", () => {
  it("extracts the host from a full URL", () => {
    const r = parseDomain("https://www.loja.com.br/produto?utm=x");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.host).toBe("www.loja.com.br");
  });

  it("accepts a bare domain", () => {
    const r = parseDomain("loja.com.br");
    if (r.ok) expect(r.host).toBe("loja.com.br");
  });

  it("rejects a raw IP — no registry to check", () => {
    expect(parseDomain("192.168.0.1")).toEqual({ ok: false, reason: "ip" });
  });

  it("flags free hosts, which prove nothing about a business", () => {
    for (const h of [
      "golpe.wixsite.com",
      "meusite.blogspot.com",
      "promo.linktr.ee",
      "lp.netlify.app",
    ]) {
      expect(parseDomain(h)).toEqual({ ok: false, reason: "free_host" });
    }
  });

  it("rejects empty and malformed input", () => {
    expect(parseDomain("")).toEqual({ ok: false, reason: "empty" });
    expect(parseDomain("nao-e-dominio")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("registrableDomain", () => {
  it("handles the Brazilian multi-part TLD", () => {
    expect(registrableDomain("www.loja.com.br")).toBe("loja.com.br");
    expect(registrableDomain("petrobras.com.br")).toBe("petrobras.com.br");
  });

  it("handles ordinary TLDs", () => {
    expect(registrableDomain("www.google.com")).toBe("google.com");
    expect(registrableDomain("a.b.c.example.io")).toBe("example.io");
  });
});

describe("evaluateCompany", () => {
  it("rewards an active, long-established company", () => {
    const signals = evaluateCompany(company(), NOW);
    expect(signals.some((s) => s.id === "cnpj.active")).toBe(true);
    expect(signals.some((s) => s.id === "cnpj.established")).toBe(true);
    expect(signals.every((s) => s.weight <= 0)).toBe(true);
  });

  it("flags a recently opened company as risk, with the date as evidence", () => {
    const signals = evaluateCompany(company({ dataAbertura: iso(30) }), NOW);
    const s = signals.find((x) => x.id === "cnpj.very-new");
    expect(s?.level).toBe("risk");
    expect(s?.evidence).toContain("30 dias");
  });

  it("treats a closed company as a hard risk", () => {
    const signals = evaluateCompany(company({ situacao: "BAIXADA" }), NOW);
    const s = signals.find((x) => x.id === "cnpj.inactive");
    expect(s?.level).toBe("risk");
    expect(s?.detail).toContain("encerrada");
  });

  it("distinguishes suspended (attention) from closed (risk)", () => {
    const susp = evaluateCompany(company({ situacao: "SUSPENSA" }), NOW);
    expect(susp.find((x) => x.id === "cnpj.inactive")?.level).toBe("attention");
  });

  it("never emits a signal without evidence when the fact exists", () => {
    const signals = evaluateCompany(company(), NOW);
    const withDate = signals.find((s) => s.id === "cnpj.established");
    expect(withDate?.evidence).toBeTruthy();
  });
});

describe("evaluateDomain", () => {
  it("flags a three-day-old domain as risk", () => {
    const signals = evaluateDomain(domain({ registeredAt: iso(3) }), NOW);
    expect(signals.find((s) => s.id === "domain.very-new")?.level).toBe("risk");
  });

  it("flags an expired domain", () => {
    const signals = evaluateDomain(domain({ expiresAt: iso(10) }), NOW);
    expect(signals.find((s) => s.id === "domain.expired")?.level).toBe("risk");
  });

  it("flags a domain expiring soon as attention, not risk", () => {
    const signals = evaluateDomain(domain({ expiresAt: iso(-10) }), NOW);
    expect(signals.find((s) => s.id === "domain.expiring")?.level).toBe("attention");
  });

  it("says 'unknown' — not risky — when the registry returns no date", () => {
    const signals = evaluateDomain(domain({ registeredAt: null }), NOW);
    const s = signals.find((x) => x.id === "domain.unknown-age");
    expect(s?.level).toBe("unknown");
    expect(s?.weight).toBe(0);
    expect(s?.detail).toContain("não é prova de risco");
  });
});

describe("scoreTrust", () => {
  it("gives a high score to an established, active company with an old domain", () => {
    const signals = [
      ...evaluateCompany(company(), NOW),
      ...evaluateDomain(domain(), NOW),
      ...evaluateCnpjDomainMatch(company(), domain()),
    ];
    const v = scoreTrust(signals);
    expect(v.level).toBe("high");
    expect(v.score).toBeGreaterThanOrEqual(70);
    expect(v.riskCount).toBe(0);
  });

  it("cannot let good signals average out a closed company", () => {
    // Everything else is pristine; the CNPJ is dead. That must dominate.
    const signals = [
      ...evaluateCompany(company({ situacao: "BAIXADA", dataAbertura: iso(20000) }), NOW),
      ...evaluateDomain(domain(), NOW),
    ];
    const v = scoreTrust(signals);
    expect(v.level).toBe("low");
  });

  it("reports 'insufficient' — not 'low' — when nothing could be verified", () => {
    const v = scoreTrust([
      {
        id: "domain.unknown-age",
        level: "unknown",
        title: "x",
        detail: "y",
        source: "domain",
        weight: 0,
      },
    ]);
    expect(v.level).toBe("insufficient");
    expect(v.score).toBe(0);
    // The distinction matters: "we couldn't check" is not "we checked and it's bad".
    expect(v.headline).toContain("Sem dados");
  });

  it("keeps the score inside 0..100", () => {
    const absurd = Array.from({ length: 30 }, (_, i) => ({
      id: `x${i}`,
      level: "risk" as const,
      title: "t",
      detail: "d",
      source: "cnpj" as const,
      weight: 50,
    }));
    const v = scoreTrust(absurd);
    expect(v.score).toBeGreaterThanOrEqual(0);
    expect(v.score).toBeLessThanOrEqual(100);
  });
});

describe("evaluateCnpjDomainMatch", () => {
  it("always asks the human to cross-check, because no registry does it", () => {
    const signals = evaluateCnpjDomainMatch(company(), domain());
    expect(signals).toHaveLength(1);
    expect(signals[0].id).toBe("cross.check-manually");
    expect(signals[0].weight).toBe(0);
  });

  it("is silent when one side is missing", () => {
    expect(evaluateCnpjDomainMatch(null, domain())).toEqual([]);
    expect(evaluateCnpjDomainMatch(company(), null)).toEqual([]);
  });
});
