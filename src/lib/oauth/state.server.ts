/**
 * Signed CSRF state for OAuth round-trip.
 *
 * The state we send to the provider is:  base64url( payload ) "." base64url( hmac )
 * Payload carries: workspaceId, userId, provider, brandId?, nonce, exp.
 *
 * We sign with HMAC-SHA256 keyed by OAUTH_TOKEN_ENC_KEY so no extra secret is
 * required. The callback verifies the signature and freshness before trusting
 * the workspace_id it persists.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_TTL_SECONDS = 600;

interface StatePayload {
  workspaceId: string;
  userId: string;
  provider: string;
  brandId?: string | null;
  redirectUri: string;
  nonce: string;
  exp: number;
}

function key(): Buffer {
  const raw = process.env.OAUTH_TOKEN_ENC_KEY;
  if (!raw) throw new Error("OAUTH_TOKEN_ENC_KEY is not configured");
  return Buffer.from(raw, "base64");
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signState(input: Omit<StatePayload, "nonce" | "exp">): string {
  const payload: StatePayload = {
    ...input,
    nonce: randomBytes(8).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(payload));
  const mac = b64url(createHmac("sha256", key()).update(body).digest());
  return `${body}.${mac}`;
}

export function verifyState(token: string): StatePayload {
  const [body, mac] = token.split(".");
  if (!body || !mac) throw new Error("malformed state");
  const expected = b64url(createHmac("sha256", key()).update(body).digest());
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("state signature mismatch");
  }
  const payload = JSON.parse(fromB64url(body).toString("utf8")) as StatePayload;
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("state expired");
  }
  return payload;
}
