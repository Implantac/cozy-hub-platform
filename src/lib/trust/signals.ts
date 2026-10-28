/**
 * VELT — Trust signals: pure validation and scoring.
 *
 * Trust OS until now was: user writes observations → LLM assigns a risk score.
 * That is the exact failure mode the AI coach exists to prevent. A model cannot
 * know whether a CNPJ exists, whether it is active, or whether a domain was
 * registered last week — but it *will* answer confidently if asked.
 *
 * So the order is inverted here:
 *
 *   1. Pull hard facts from public registries (CNPJ via BrasilAPI, domain via
 *      RDAP). These are verifiable: anyone can re-run the query.
 *   2. Score deterministically from those facts, with the evidence attached to
 *      each signal.
 *   3. The LLM may only *narrate* the result. It never invents a fact and never
 *      sets the score.
 *
 * This module is pure: no network, no database. Everything that can be checked
 * without I/O is checked here, which means the CNPJ checksum catches a typo
 * before a single request leaves the server.
 */

/* ------------------------------------------------------------------ */
/* CNPJ                                                                */
/* ------------------------------------------------------------------ */

export type CnpjParse =
  | { ok: true; digits: string; formatted: string }
  | { ok: false; reason: "empty" | "length" | "repeated" | "checksum" };

/**
 * Validates a CNPJ including the two check digits.
 *
 * A regex is not enough and the difference matters: `11.222.333/0001-00` has the
 * right shape and does not exist. Without the checksum, every typo becomes an
 * API call and a misleading "not found" instead of "confira o número".
 */
export function parseCnpj(raw: string | null | undefined): CnpjParse {
  const digits = String(raw ?? "").replace(/\D/g, "");

  if (!digits) return { ok: false, reason: "empty" };
  if (digits.length !== 14) return { ok: false, reason: "length" };
  // 00000000000000 and friends pass the length check and fail arithmetic later
  // in a confusing way; name the real problem.
  if (/^(\d)\1{13}$/.test(digits)) return { ok: false, reason: "repeated" };

  if (!cnpjChecksum(digits)) return { ok: false, reason: "checksum" };

  return {
    ok: true,
    digits,
    formatted: `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`,
  };
}

/** Standard modulus-11 check with weights 2..9 cycling from the right. */
function cnpjChecksum(digits: string): boolean {
  const calc = (slice: string, weights: number[]) => {
    const sum = slice.split("").reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  return (
    calc(digits.slice(0, 12), w1) === Number(digits[12]) &&
    calc(digits.slice(0, 13), w2) === Number(digits[13])
  );
}

/* ------------------------------------------------------------------ */
/* Domain                                                              */
/* ------------------------------------------------------------------ */

export type DomainParse =
  { ok: true; host: string } | { ok: false; reason: "empty" | "invalid" | "ip" | "free_host" };

/**
 * Platforms where anyone can create a page in seconds. A "site" hosted there
 * says nothing about the business — it is the standard tool of throwaway scam
 * landing pages, so it is flagged rather than rejected.
 */
const FREE_HOSTS = [
  "wixsite.com",
  "weebly.com",
  "blogspot.com",
  "wordpress.com",
  "github.io",
  "netlify.app",
  "vercel.app",
  "web.app",
  "firebaseapp.com",
  "linktr.ee",
  "bio.link",
  "beacons.ai",
  "carrd.co",
  "notion.site",
  "canva.site",
  "google.com",
];

export function parseDomain(raw: string | null | undefined): DomainParse {
  const input = String(raw ?? "").trim();
  if (!input) return { ok: false, reason: "empty" };

  // Accept both "example.com" and "https://example.com/path?x=1".
  let host: string;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`;
    host = new URL(withScheme).hostname.toLowerCase();
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (!host || !host.includes(".")) return { ok: false, reason: "invalid" };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return { ok: false, reason: "ip" };
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return { ok: false, reason: "invalid" };

  if (FREE_HOSTS.some((f) => host === f || host.endsWith(`.${f}`))) {
    return { ok: false, reason: "free_host" };
  }

  return { ok: true, host };
}

/** Registrable domain (`www.loja.com.br` → `loja.com.br`) for RDAP queries. */
export function registrableDomain(host: string): string {
  const parts = host.split(".");
  const multiPartTlds = ["com.br", "net.br", "org.br", "art.br", "loja.br", "app.br"];
  const lastTwo = parts.slice(-2).join(".");
  if (multiPartTlds.includes(lastTwo) && parts.length >= 3) return parts.slice(-3).join(".");
  return lastTwo;
}

/* ------------------------------------------------------------------ */
/* Signals                                                             */
/* ------------------------------------------------------------------ */

export type TrustLevel = "verified" | "attention" | "risk" | "unknown";

export interface TrustSignal {
  /** Stable id — the UI groups and tests against these. */
  id: string;
  level: TrustLevel;
  /** Human title, PT-BR. */
  title: string;
  /** Why it matters, and never without the evidence that produced it. */
  detail: string;
  /** The raw fact this signal was derived from, shown to the user. */
  evidence?: string;
  /** Which registry this came from, so the user can re-run the check. */
  source: "cnpj" | "domain" | "internal";
  /** How much this moves the score. Negative is risk. */
  weight: number;
}

/** Facts relevant to trust, normalised from whatever the registry returned. */
export interface CompanyFacts {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacao: string; // ATIVA, BAIXADA, SUSPENSA...
  dataSituacao: string | null;
  dataAbertura: string | null;
  porte: string | null;
  naturezaJuridica: string | null;
  cnae: string | null;
  municipio: string | null;
  uf: string | null;
  capitalSocial: number | null;
  mei: boolean;
  simples: boolean;
  socios: number;
}

export interface DomainFacts {
  host: string;
  registeredAt: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
  statuses: string[];
}

const MS_PER_DAY = 86_400_000;

/** Whole days from `iso` until `now`. Positive = in the past, negative = future. */
function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / MS_PER_DAY);
}

/**
 * Whole days from `now` until `iso`. Positive = in the future, negative = already
 * past. Kept separate from `daysSince` on purpose: the first version reused one
 * helper for both directions and the expiry check silently inverted, so an expired
 * domain produced no signal at all. Two names, one meaning each.
 */
function daysUntil(iso: string | null, now: number): number | null {
  const since = daysSince(iso, now);
  return since === null ? null : -since;
}

/**
 * Turns registry facts into weighted signals.
 *
 * `now` is injected so age thresholds are testable without freezing the clock.
 */
export function evaluateCompany(facts: CompanyFacts, now: number = Date.now()): TrustSignal[] {
  const out: TrustSignal[] = [];
  const situacao = (facts.situacao ?? "").toUpperCase();

  if (situacao === "ATIVA") {
    out.push({
      id: "cnpj.active",
      level: "verified",
      title: "CNPJ ativo na Receita",
      detail: "A empresa existe e está regular perante a Receita Federal.",
      evidence: facts.dataSituacao ? `Situação desde ${fmtDate(facts.dataSituacao)}` : undefined,
      source: "cnpj",
      weight: -20,
    });
  } else if (situacao) {
    const baixada = /BAIXAD|INAPTA|NULA/.test(situacao);
    out.push({
      id: "cnpj.inactive",
      level: baixada ? "risk" : "attention",
      title: `CNPJ com situação "${situacao}"`,
      detail: baixada
        ? "Empresa encerrada ou nula. Cobrar ou contratar nesse CNPJ é risco real de não ter a quem recorrer."
        : "A situação cadastral não é ATIVA. Confirme antes de pagar qualquer valor.",
      evidence: facts.dataSituacao ? `Desde ${fmtDate(facts.dataSituacao)}` : undefined,
      source: "cnpj",
      weight: baixada ? 35 : 20,
    });
  }

  const ageDays = daysSince(facts.dataAbertura, now);
  if (ageDays !== null) {
    if (ageDays < 90) {
      out.push({
        id: "cnpj.very-new",
        level: "risk",
        title: "Empresa aberta há menos de 3 meses",
        detail:
          "Negócio recém-aberto não é golpe por definição, mas é onde a maioria dos golpes está. Peça contrato e nota fiscal.",
        evidence: `Aberta em ${fmtDate(facts.dataAbertura)} (${ageDays} dias)`,
        source: "cnpj",
        weight: 25,
      });
    } else if (ageDays < 365) {
      out.push({
        id: "cnpj.new",
        level: "attention",
        title: "Empresa com menos de 1 ano",
        detail:
          "Sem histórico suficiente para avaliar. Peso maior no contrato e na forma de pagamento.",
        evidence: `Aberta em ${fmtDate(facts.dataAbertura)}`,
        source: "cnpj",
        weight: 10,
      });
    } else {
      out.push({
        id: "cnpj.established",
        level: "verified",
        title: `Empresa ativa há ${Math.floor(ageDays / 365)} ano(s)`,
        detail: "Tempo de operação é o sinal mais barato de confiabilidade que existe.",
        evidence: `Aberta em ${fmtDate(facts.dataAbertura)}`,
        source: "cnpj",
        weight: -15,
      });
    }
  }

  if (facts.capitalSocial !== null && facts.capitalSocial === 0 && facts.socios === 0) {
    out.push({
      id: "cnpj.no-capital-no-partners",
      level: "attention",
      title: "Sem capital social e sem sócios registrados",
      detail:
        "Não é irregular, mas some com a rastreabilidade: não há patrimônio nem pessoa a quem responsabilizar.",
      source: "cnpj",
      weight: 10,
    });
  }

  return out;
}

export function evaluateDomain(facts: DomainFacts, now: number = Date.now()): TrustSignal[] {
  const out: TrustSignal[] = [];
  const ageDays = daysSince(facts.registeredAt, now);

  if (ageDays === null) {
    out.push({
      id: "domain.unknown-age",
      level: "unknown",
      title: "Não foi possível confirmar o registro do domínio",
      detail:
        "O registrador não devolveu a data de criação. Ausência de dado não é prova de risco.",
      evidence: facts.host,
      source: "domain",
      weight: 0,
    });
  } else if (ageDays < 90) {
    out.push({
      id: "domain.very-new",
      level: "risk",
      title: "Domínio registrado há menos de 3 meses",
      detail:
        "Sites de golpe têm vida curta e trocam de domínio com frequência. Desconfie de pressa e de pagamento por PIX.",
      evidence: `Registrado em ${fmtDate(facts.registeredAt)} (${ageDays} dias)`,
      source: "domain",
      weight: 25,
    });
  } else if (ageDays < 365) {
    out.push({
      id: "domain.new",
      level: "attention",
      title: "Domínio com menos de 1 ano",
      detail: "Ainda sem histórico. Verifique se o CNPJ informado no site é o mesmo do contrato.",
      evidence: `Registrado em ${fmtDate(facts.registeredAt)}`,
      source: "domain",
      weight: 10,
    });
  } else {
    out.push({
      id: "domain.established",
      level: "verified",
      title: `Domínio registrado há ${Math.floor(ageDays / 365)} ano(s)`,
      detail: "Domínio antigo é caro de manter e barato de verificar — bom sinal.",
      evidence: `Registrado em ${fmtDate(facts.registeredAt)}`,
      source: "domain",
      weight: -15,
    });
  }

  const expiresIn = daysUntil(facts.expiresAt, now);
  if (expiresIn !== null && expiresIn < 0) {
    out.push({
      id: "domain.expired",
      level: "risk",
      title: "Domínio vencido",
      detail: "Um site no ar com domínio vencido indica abandono ou descuido na operação.",
      evidence: `Venceu em ${fmtDate(facts.expiresAt)}`,
      source: "domain",
      weight: 20,
    });
  } else if (expiresIn !== null && expiresIn < 30) {
    out.push({
      id: "domain.expiring",
      level: "attention",
      title: "Domínio vence em menos de 30 dias",
      detail: "Pode sair do ar durante a relação comercial.",
      evidence: `Vence em ${fmtDate(facts.expiresAt)}`,
      source: "domain",
      weight: 8,
    });
  }

  return out;
}

/** CNPJ do site ≠ CNPJ do contrato is the single most common scam pattern. */
export function evaluateCnpjDomainMatch(
  cnpj: CompanyFacts | null,
  domain: DomainFacts | null,
): TrustSignal[] {
  if (!cnpj || !domain) return [];
  return [
    {
      id: "cross.check-manually",
      level: "unknown",
      title: "Confira se o CNPJ do site é o mesmo do contrato",
      detail:
        "Nenhum registro público diz qual CNPJ opera qual site. Essa é a checagem que mais pega golpe — e a única que ainda depende de você.",
      evidence: `${cnpj.razaoSocial} · ${cnpj.cnpj} → ${domain.host}`,
      source: "internal",
      weight: 0,
    },
  ];
}

/**
 * Aggregates signals into a 0–100 confidence score with a verdict.
 *
 * Starts at 50 ("unknown") and moves by weights. A registry failure must not
 * look like a bad sign, so `unknown` signals carry zero weight and the verdict
 * says so explicitly.
 */
export interface TrustVerdict {
  score: number; // 0-100, higher = more trustworthy
  level: "high" | "moderate" | "low" | "insufficient";
  headline: string;
  signals: TrustSignal[];
  verifiedCount: number;
  riskCount: number;
}

export function scoreTrust(signals: TrustSignal[]): TrustVerdict {
  const riskSignals = signals.filter((s) => s.level === "risk");
  const verified = signals.filter((s) => s.level === "verified");
  const factual = signals.filter((s) => s.level !== "unknown");

  if (factual.length === 0) {
    return {
      score: 0,
      level: "insufficient",
      headline: "Sem dados verificáveis sobre este alvo.",
      signals,
      verifiedCount: 0,
      riskCount: 0,
    };
  }

  const total = signals.reduce((acc, s) => acc + s.weight, 0);
  const score = Math.max(0, Math.min(100, Math.round(50 - total)));

  // A single hard risk (company closed, expired domain) caps the verdict: no
  // amount of good signals should be able to average out a dead CNPJ.
  const hardRisk = riskSignals.some(
    (s) => s.id === "cnpj.inactive" || s.id === "domain.expired" || s.id === "domain.very-new",
  );

  let level: TrustVerdict["level"];
  if (hardRisk) level = "low";
  else if (score >= 70) level = "high";
  else if (score >= 45) level = "moderate";
  else level = "low";

  const headline =
    level === "high"
      ? "Os registros públicos conferem e sustentam a operação."
      : level === "moderate"
        ? "Existe base real, com pontos que merecem checagem antes de pagar."
        : "Os registros apontam risco concreto. Não avance sem garantia de reembolso.";

  return {
    score,
    level,
    headline,
    signals,
    verifiedCount: verified.length,
    riskCount: riskSignals.length,
  };
}

function fmtDate(iso: string | null): string {
  if (!iso) return "data desconhecida";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
