#!/usr/bin/env node
/**
 * Prints the collected CSP violations and says whether the policy can be
 * enforced.
 *
 * The CSP ships as Report-Only. Enforcing it is a decision, and the only honest
 * way to make that decision is to look at what actually violated. This is that
 * look, from a terminal, without opening the dashboard.
 *
 *   node scripts/csp-report.mjs           # últimos 7 dias
 *   node scripts/csp-report.mjs 30        # últimos 30 dias
 *
 * Exits 0 when the policy is safe to enforce, 1 when violations exist, so it can
 * be wired into a check that gates `CSP_MODE=enforce`.
 */

import { createClient } from "@supabase/supabase-js";

const windowDays = Number(process.argv[2] ?? 7);
if (!Number.isFinite(windowDays) || windowDays <= 0) {
  console.error("uso: node scripts/csp-report.mjs [dias]");
  process.exit(2);
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error(
    "Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_PUBLISHABLE_KEY).\n" +
      "Rode com: node --env-file=.env scripts/csp-report.mjs",
  );
  process.exit(2);
}

/**
 * Node 20 has no native WebSocket, and supabase-js builds a Realtime client
 * eagerly when constructing — it throws before any query runs, even though this
 * script never touches Realtime. The app works around it in `reports/weekly.ts`
 * the same way; here a minimal transport stub is enough, because a client that is
 * never used cannot open a socket.
 */
class InertWebSocket {
  constructor() {}
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

const realtime =
  typeof globalThis.WebSocket === "function" ? undefined : { transport: InertWebSocket };

const supabase = createClient(url, key, {
  auth: { persistSession: false },
  ...(realtime ? { realtime } : {}),
});

const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
const { data, error } = await supabase
  .from("audit_logs")
  .select("created_at, metadata")
  .eq("action", "csp.violation")
  .gte("created_at", since)
  .order("created_at", { ascending: false })
  .limit(5000);

if (error) {
  console.error("Falha ao ler audit_logs:", error.message);
  process.exit(2);
}

/**
 * Proves the collector can write, so silence can be trusted.
 *
 * Writes one report through the same path a browser would and reads it back. If
 * it does not appear, the honest answer is "unknown", not "clean".
 */
async function checkCollector() {
  const base = process.env.CSP_REPORT_URL;
  if (!base) return false;

  const marker = `https://probe.invalid/csp-check-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/csp-report`, {
      method: "POST",
      headers: { "content-type": "application/csp-report" },
      body: JSON.stringify({
        "csp-report": {
          "document-uri": "https://velt.app/probe",
          "effective-directive": "img-src",
          "blocked-uri": marker,
        },
      }),
    });
    // The endpoint answers 500 when the write failed; that is the signal.
    return res.status === 204;
  } catch {
    return false;
  }
}

/** Same reduction the app uses, reimplemented here so the script stands alone. */
const NOT_A_SOURCE = new Set(["inline", "eval", "wasm-eval"]);
const SOURCE_DIRECTIVE = {
  "script-src-elem": "script-src",
  "script-src-attr": "script-src",
  "style-src-elem": "style-src",
  "style-src-attr": "style-src",
};

function hostOf(blocked) {
  if (!blocked) return null;
  if (!blocked.includes("://")) return blocked;
  try {
    const u = new URL(blocked);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function suggestionFor(directive, hosts) {
  const target = SOURCE_DIRECTIVE[directive] ?? directive;
  const clean = hosts.filter((h) => h && !NOT_A_SOURCE.has(h) && !/[\s;'"]/.test(h));
  if (clean.length === 0) {
    return `${target} ... (sem host útil: ${directive} bloqueou algo sem origem — provavelmente 'unsafe-inline' ou um nonce faltando)`;
  }
  return `${target} ${clean.join(" ")}`;
}

const byDirective = new Map();
for (const row of data ?? []) {
  const meta = row.metadata;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) continue;

  const directive =
    typeof meta.effectiveDirective === "string" && meta.effectiveDirective
      ? meta.effectiveDirective
      : typeof meta.violatedDirective === "string"
        ? meta.violatedDirective.split(" ")[0]
        : null;
  if (!directive) continue;

  const entry = byDirective.get(directive) ?? { count: 0, hosts: new Map() };
  entry.count += 1;
  const host = hostOf(typeof meta.blockedURI === "string" ? meta.blockedURI : null);
  if (host) entry.hosts.set(host, (entry.hosts.get(host) ?? 0) + 1);
  byDirective.set(directive, entry);
}

const total = [...byDirective.values()].reduce((n, e) => n + e.count, 0);

if (total === 0) {
  /**
   * "Zero violations" has two very different meanings: the policy is clean, or
   * nothing was ever collected. The second is far more likely on a fresh
   * deployment or when the service-role key is missing — and it is the exact
   * failure that makes the enforcement decision wrong. Check the collector before
   * believing the silence.
   */
  const reachable = await checkCollector();
  if (!reachable) {
    console.error(
      `Nenhuma violação registrada em ${windowDays} dias — mas o coletor não ` +
        `confirmou que grava.\n` +
        `Zero pode significar "política limpa" ou "nada foi coletado".\n` +
        `NÃO ligue CSP_MODE=enforce antes de resolver isso.`,
    );
    process.exit(2);
  }
  console.log(
    `Nenhuma violação de CSP nos últimos ${windowDays} dias.\n` +
      `Seguro para ligar CSP_MODE=enforce.`,
  );
  process.exit(0);
}

console.log(`${total} violações em ${windowDays} dias (${byDirective.size} diretivas):\n`);
for (const [directive, entry] of [...byDirective.entries()].sort(
  (a, b) => b[1].count - a[1].count,
)) {
  const hosts = [...entry.hosts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([h]) => h);
  console.log(`  ${directive}  ×${entry.count}`);
  if (hosts.length) console.log(`    hosts: ${hosts.join(", ")}`);
  console.log(`    se for legítimo: ${suggestionFor(directive, hosts)}\n`);
}
console.log("Ligue CSP_MODE=enforce só depois que esta lista estiver vazia.");
process.exit(1);
