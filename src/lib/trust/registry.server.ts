/**
 * VELT — Trust registry clients (server-only).
 *
 * Two public sources, no API keys:
 *
 *   - CNPJ  → BrasilAPI (`/api/cnpj/v1/{cnpj}`), which mirrors the Receita
 *             Federal open data. Confirmed contract: 200 with the company,
 *             404 with `{ type: "not_found" }` for an unknown CNPJ.
 *   - Domain → RDAP over `rdap.org`, which brokers to the authoritative registry
 *             (Registro.br for `.br`). Returns `events[]` with
 *             `registration`/`expiration`.
 *
 * Both are free and unauthenticated, which is exactly why they need care:
 *
 *   - **No SLA.** BrasilAPI is a community project. A timeout is normal, not an
 *     incident, so a failure is reported as `unavailable` and *never* as a risk
 *     signal. "Could not check" and "checked and it is bad" are different
 *     answers and must never be confused in a product about trust.
 *   - **Caching is not an optimisation here, it is politeness.** Registry data
 *     changes daily at most. A 6-hour in-process cache keeps a marketing page
 *     from hammering a volunteer-run API.
 *   - **Nothing is written to the database on a failed lookup.** A missing row
 *     would later read as "we looked and there was nothing", which is false.
 */

import { registrableDomain } from "./signals";

const CNPJ_BASE = "https://brasilapi.com.br/api/cnpj/v1";
const RDAP_BASE = "https://rdap.org/domain";

const TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type Lookup<T> =
  | { status: "ok"; data: T }
  | { status: "not_found" }
  | { status: "unavailable"; reason: string };

interface CacheEntry {
  at: number;
  value: Lookup<unknown>;
}

const cache = new Map<string, CacheEntry>();

function readCache<T>(key: string): Lookup<T> | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value as Lookup<T>;
}

function writeCache(key: string, value: Lookup<unknown>) {
  cache.set(key, { at: Date.now(), value });
  // Bounded cache: this runs in a long-lived server process and must not grow
  // with every CNPJ anyone ever types.
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

/** Raw shape returned by BrasilAPI, reduced to the fields trust actually uses. */
export interface CnpjApiResponse {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string | null;
  descricao_situacao_cadastral?: string;
  data_situacao_cadastral?: string | null;
  data_inicio_atividade?: string | null;
  porte?: string | null;
  natureza_juridica?: string | null;
  cnae_fiscal_descricao?: string | null;
  municipio?: string | null;
  uf?: string | null;
  capital_social?: number | null;
  opcao_pelo_mei?: boolean | null;
  opcao_pelo_simples?: boolean | null;
  qsa?: unknown[];
}

async function fetchJson(url: string): Promise<{ status: number; body: unknown } | null> {
  // AbortController rather than Promise.race: a loser promise that keeps running
  // still holds a socket, and this endpoint is called from a page load.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        // Mandatory, not cosmetic: BrasilAPI answers 403 to a request with no
        // User-Agent, and Node's fetch sends none by default. This failed
        // silently against the real API while every mocked test passed — the
        // exact class of bug that only a live smoke test catches. Identifying
        // ourselves honestly also gives the volunteers running the API someone
        // to contact if this client misbehaves.
        "user-agent": "VELT-TrustOS/1.0 (+https://velt.app; due-diligence)",
      },
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body };
  } catch (e) {
    const reason = e instanceof Error && e.name === "AbortError" ? "timeout" : "network_error";
    console.warn(`[trust] ${url} → ${reason}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupCnpj(digits: string): Promise<Lookup<CnpjApiResponse>> {
  const key = `cnpj:${digits}`;
  const cached = readCache<CnpjApiResponse>(key);
  if (cached) return cached;

  const res = await fetchJson(`${CNPJ_BASE}/${digits}`);
  let result: Lookup<CnpjApiResponse>;

  if (!res) {
    // Not cached: a transient failure should be retried on the next visit.
    return { status: "unavailable", reason: "fonte fora do ar" };
  }

  if (res.status === 404) {
    result = { status: "not_found" };
  } else if (res.status === 200 && res.body && typeof res.body === "object") {
    result = { status: "ok", data: res.body as CnpjApiResponse };
  } else if (res.status === 429) {
    return { status: "unavailable", reason: "limite de consultas atingido" };
  } else {
    return { status: "unavailable", reason: `resposta inesperada (${res.status})` };
  }

  writeCache(key, result);
  return result;
}

export interface RdapResponse {
  ldhName?: string;
  events?: Array<{ eventAction?: string; eventDate?: string }>;
  status?: string[];
}

export async function lookupDomain(host: string): Promise<Lookup<RdapResponse>> {
  const domain = registrableDomain(host.toLowerCase());
  const key = `domain:${domain}`;
  const cached = readCache<RdapResponse>(key);
  if (cached) return cached;

  // `rdap.org` redirects to the authoritative registry; fetch follows redirects.
  const res = await fetchJson(`${RDAP_BASE}/${domain}`);
  let result: Lookup<RdapResponse>;

  if (!res) return { status: "unavailable", reason: "fonte fora do ar" };

  if (res.status === 404) {
    result = { status: "not_found" };
  } else if (res.status === 200 && res.body && typeof res.body === "object") {
    result = { status: "ok", data: res.body as RdapResponse };
  } else {
    return { status: "unavailable", reason: `resposta inesperada (${res.status})` };
  }

  writeCache(key, result);
  return result;
}

/** Extracts the RDAP event dates trust cares about. */
export function eventsOf(rdap: RdapResponse): {
  registeredAt: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
} {
  const find = (action: string) =>
    rdap.events?.find((e) => e.eventAction?.toLowerCase() === action)?.eventDate ?? null;
  return {
    registeredAt: find("registration"),
    expiresAt: find("expiration"),
    updatedAt: find("last changed"),
  };
}

/** Exposed for tests; not part of the public surface. */
export function _clearTrustCache() {
  cache.clear();
}
