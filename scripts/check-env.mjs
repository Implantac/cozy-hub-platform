#!/usr/bin/env node
/**
 * Refuses to build with a privileged Supabase key in a committed env file.
 *
 * Why this exists: `.env` is versioned in this repository on purpose. The Vite
 * client resolves `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` at BUILD
 * time, so a build environment without those files produces a bundle that throws
 * "Missing Supabase environment variable(s)" in the user's browser — which is
 * exactly what happened when `.env` was briefly removed from version control.
 *
 * The publishable (`anon`) key is public by design: it ships in every browser
 * bundle already and is constrained by RLS. A `service_role` key is not — it
 * bypasses RLS entirely. If one ever lands in a tracked file, every clone, fork
 * and backup contains a key that can read and write every tenant's data.
 *
 * This check runs before the build so that mistake fails loudly, at the moment
 * it is introduced, instead of shipping quietly.
 *
 * Nothing secret is printed: only the file, the variable and what kind of key it
 * looks like.
 */

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const TRACKED_ENV_FILES = [".env", ".env.local", ".env.development", ".env.production"];

/** Decodes the `role` claim of a Supabase JWT. Returns null for opaque formats. */
function jwtRole(value) {
  const token = value.trim().replace(/^["']|["']$/g, "");
  if (!token.startsWith("eyJ")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return typeof claims.role === "string" ? claims.role : null;
  } catch {
    return null;
  }
}

/** Supabase's newer key format carries the privilege level in the prefix. */
function prefixedKeyKind(value) {
  const token = value.trim().replace(/^["']|["']$/g, "");
  if (token.startsWith("sb_secret_")) return "secret";
  if (token.startsWith("sb_publishable_")) return "publishable";
  return null;
}

function isTracked(file) {
  try {
    execSync(`git ls-files --error-unmatch ${JSON.stringify(file)}`, {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

const problems = [];

for (const file of TRACKED_ENV_FILES) {
  if (!existsSync(file)) continue;
  // An untracked file is the developer's own business; only committed ones ship.
  if (!isTracked(file)) continue;

  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) return;
    const [, name, rawValue] = match;
    if (!rawValue) return;

    const role = jwtRole(rawValue);
    const kind = prefixedKeyKind(rawValue);

    if (role === "service_role" || kind === "secret") {
      problems.push({
        file,
        line: i + 1,
        name,
        what: role === "service_role" ? "service_role JWT" : "sb_secret_ key",
      });
    }
  });
}

if (problems.length > 0) {
  console.error("\n[env-guard] Build bloqueado: chave privilegiada em arquivo versionado.\n");
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line} — ${p.name} parece ser uma ${p.what}`);
  }
  console.error(
    "\nUma service_role key ignora RLS: qualquer clone ou fork do repositório passaria a\n" +
      "ler e escrever dados de todos os tenants. Mova-a para o ambiente do servidor\n" +
      "(variável de deploy), nunca para um arquivo versionado.\n" +
      "A chave publicável (`anon` / `sb_publishable_`) é pública por design e pode ficar.\n",
  );
  process.exit(1);
}

console.log("[env-guard] ok — nenhuma chave privilegiada em arquivos versionados.");
