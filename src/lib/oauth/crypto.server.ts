/**
 * AES-256-GCM crypto for OAuth tokens at rest.
 *
 * Format on disk:  base64( iv[12] || tag[16] || ciphertext )
 *
 * Key is OAUTH_TOKEN_ENC_KEY (base64 of 32 random bytes). Rotated by
 * re-encrypting all rows under a new key inside a maintenance server fn.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function loadKey(): Buffer {
  const raw = process.env.OAUTH_TOKEN_ENC_KEY;
  if (!raw) throw new Error("OAUTH_TOKEN_ENC_KEY is not configured");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `OAUTH_TOKEN_ENC_KEY must decode to 32 bytes (got ${key.length}). Generate with: openssl rand -base64 32`,
    );
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptToken(ciphertext: string): string {
  const key = loadKey();
  const buf = Buffer.from(ciphertext, "base64");
  if (buf.length < 12 + 16 + 1) throw new Error("ciphertext too short");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}
