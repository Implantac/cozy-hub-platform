#!/usr/bin/env node
/**
 * Refuses to build when a server-only credential is present in a tracked env file.
 *
 * Why this exists: `.env` is versioned in this repository on purpose. The Vite
 * client resolves `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` at BUILD
 * time, so a build environment without those files produces a bundle that throws
 * "Missing Supabase environment variable(s)" in the user's browser — which is
 * exactly what happened when `.env` was briefly removed from version control.
 *
 * The publishable (`anon`) key is public by design: it ships in every browser
 * bundle already and is constrained by RLS. Server-only credentials (service
 * role, OAuth clients, cron and encryption keys) must never enter a tracked file.
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
const SERVER_ONLY_SECRET_NAMES = new Set([
  "SUPABASE_SERVICE_ROLE_KEY",
  "OAUTH_TOKEN_ENC_KEY",
  "CRON_SECRET",
  "META_APP_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "LINKEDIN_CLIENT_SECRET",
  "TIKTOK_CLIENT_SECRET",
  "LOVABLE_API_KEY",
  "STUDIO_WORKER_SECRET",
]);

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
    const value = rawValue
      .trim()
      .replace(/^(['"])(.*)\1$/, "$2")
      .trim();
    if (!value) return;

    const role = jwtRole(value);
    const kind = prefixedKeyKind(value);
    const sensitiveName = SERVER_ONLY_SECRET_NAMES.has(name);

    if (role === "service_role" || kind === "secret" || sensitiveName) {
      problems.push({
        file,
        line: i + 1,
        name,
        what:
          role === "service_role"
            ? "service_role JWT"
            : kind === "secret"
              ? "sb_secret_ key"
              : "segredo exclusivo do servidor",
      });
    }
  });
}

if (problems.length > 0) {
  console.error("\n[env-guard] Build bloqueado: credencial de servidor em arquivo versionado.\n");
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line} — ${p.name} parece ser uma ${p.what}`);
  }
  console.error(
    "\nCredenciais de servidor não podem ser versionadas: podem ignorar RLS, publicar em nome dos\n" +
      "usuários ou acessar provedores externos. Mova-as para variáveis protegidas do deploy.\n" +
      "A chave publicável (`anon` / `sb_publishable_`) é pública por design e pode ficar.\n",
  );
  process.exit(1);
}

console.log("[env-guard] ok — nenhum segredo de servidor conhecido em arquivos versionados.");
