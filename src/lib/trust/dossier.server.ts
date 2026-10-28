/**
 * VELT — Trust dossier builder (server-only).
 *
 * Orchestrates: validate → query registries → derive signals → score. Every step
 * is deterministic. The LLM is not part of this file, and that is the design: a
 * due-diligence verdict must be reproducible by anyone who re-runs the same two
 * public queries.
 */

import { eventsOf, lookupCnpj, lookupDomain } from "./registry.server";
import {
  evaluateCnpjDomainMatch,
  evaluateCompany,
  evaluateDomain,
  scoreTrust,
  type CompanyFacts,
  type DomainFacts,
  type TrustSignal,
  type TrustVerdict,
} from "./signals";

export interface DossierSourceState {
  cnpj: "ok" | "not_found" | "unavailable" | "not_provided" | "invalid";
  domain: "ok" | "not_found" | "unavailable" | "not_provided" | "invalid";
  /** Human-readable caveats, shown verbatim in the UI. */
  notes: string[];
}

export interface Dossier {
  verdict: TrustVerdict;
  company: CompanyFacts | null;
  domain: DomainFacts | null;
  sources: DossierSourceState;
  /** ISO timestamp of when the external data was read. Staleness must be visible. */
  fetchedAt: string;
}

export interface DossierInput {
  /** Already validated by `parseCnpj`; digits only. */
  cnpjDigits?: string | null;
  /** Already validated by `parseDomain`; hostname only. */
  domainHost?: string | null;
  /** Why the caller rejected the input, when it did. */
  cnpjInvalid?: string | null;
  domainInvalid?: string | null;
  now?: number;
}

function toCompanyFacts(raw: Awaited<ReturnType<typeof lookupCnpj>>): CompanyFacts | null {
  if (raw.status !== "ok") return null;
  const d = raw.data;
  return {
    cnpj: String(d.cnpj ?? ""),
    razaoSocial: String(d.razao_social ?? ""),
    nomeFantasia: d.nome_fantasia ?? null,
    situacao: String(d.descricao_situacao_cadastral ?? ""),
    dataSituacao: d.data_situacao_cadastral ?? null,
    dataAbertura: d.data_inicio_atividade ?? null,
    porte: d.porte ?? null,
    naturezaJuridica: d.natureza_juridica ?? null,
    cnae: d.cnae_fiscal_descricao ?? null,
    municipio: d.municipio ?? null,
    uf: d.uf ?? null,
    capitalSocial: typeof d.capital_social === "number" ? d.capital_social : null,
    mei: Boolean(d.opcao_pelo_mei),
    simples: Boolean(d.opcao_pelo_simples),
    socios: Array.isArray(d.qsa) ? d.qsa.length : 0,
  };
}

function toDomainFacts(
  host: string,
  raw: Awaited<ReturnType<typeof lookupDomain>>,
): DomainFacts | null {
  if (raw.status !== "ok") return null;
  const e = eventsOf(raw.data);
  return {
    host,
    registeredAt: e.registeredAt,
    expiresAt: e.expiresAt,
    updatedAt: e.updatedAt,
    statuses: raw.data.status ?? [],
  };
}

export async function buildDossier(input: DossierInput): Promise<Dossier> {
  const now = input.now ?? Date.now();
  const sources: DossierSourceState = {
    cnpj: input.cnpjInvalid ? "invalid" : input.cnpjDigits ? "ok" : "not_provided",
    domain: input.domainInvalid ? "invalid" : input.domainHost ? "ok" : "not_provided",
    notes: [],
  };

  // Both lookups run in parallel: they are independent and each can take seconds.
  const [cnpjRes, domainRes] = await Promise.all([
    input.cnpjDigits ? lookupCnpj(input.cnpjDigits) : Promise.resolve(null),
    input.domainHost ? lookupDomain(input.domainHost) : Promise.resolve(null),
  ]);

  let company: CompanyFacts | null = null;
  if (cnpjRes) {
    if (cnpjRes.status === "ok") {
      company = toCompanyFacts(cnpjRes);
    } else if (cnpjRes.status === "not_found") {
      sources.cnpj = "not_found";
      sources.notes.push(
        "A Receita Federal não devolveu registro para este CNPJ. Pode ser erro de digitação — confira os dígitos antes de concluir qualquer coisa.",
      );
    } else {
      sources.cnpj = "unavailable";
      sources.notes.push(
        `Não foi possível consultar o CNPJ agora (${cnpjRes.reason}). Isso não é sinal de risco: é ausência de dado.`,
      );
    }
  }

  let domain: DomainFacts | null = null;
  if (domainRes) {
    if (domainRes.status === "ok") {
      domain = toDomainFacts(input.domainHost!, domainRes);
    } else if (domainRes.status === "not_found") {
      sources.domain = "not_found";
      sources.notes.push("O domínio não está registrado. Se o site está no ar, algo está errado.");
    } else {
      sources.domain = "unavailable";
      sources.notes.push(`Não foi possível consultar o domínio agora (${domainRes.reason}).`);
    }
  }

  const signals: TrustSignal[] = [
    ...(company ? evaluateCompany(company, now) : []),
    ...(domain ? evaluateDomain(domain, now) : []),
    ...evaluateCnpjDomainMatch(company, domain),
  ];

  // A provided CNPJ that does not exist is itself a strong signal — but only when
  // the registry actually answered. Reaching "not found" through a 404 is a fact;
  // reaching it through a timeout would be an invention.
  if (sources.cnpj === "not_found") {
    signals.push({
      id: "cnpj.not-found",
      level: "risk",
      title: "CNPJ não encontrado na base pública",
      detail:
        "Nenhuma empresa com este número. Se foi informado por um vendedor, não confira: cobre o número correto.",
      source: "cnpj",
      weight: 40,
    });
  }

  if (sources.domain === "not_found") {
    signals.push({
      id: "domain.not-found",
      level: "attention",
      title: "Domínio sem registro público",
      detail: "O domínio não aparece no registro oficial. Confirme o endereço do site.",
      source: "domain",
      weight: 15,
    });
  }

  // If nothing could be verified at all, say exactly that; do not dress it up.
  if (company === null && domain === null && sources.notes.length === 0) {
    sources.notes.push("Nenhum dado verificável foi fornecido.");
  }

  return {
    verdict: scoreTrust(signals),
    company,
    domain,
    sources,
    fetchedAt: new Date(now).toISOString(),
  };
}
