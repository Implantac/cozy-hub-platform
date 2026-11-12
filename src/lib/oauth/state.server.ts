/** Signed, expiring OAuth state. The callback also requires the initiating browser's HttpOnly cookie. */
import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { z } from "zod";

export const STATE_TTL_SECONDS = 600;
export const STATE_COOKIE_PATH = "/api/public/oauth/callback";
const StateSchema = z
  .object({
    workspaceId: z.string().uuid(),
    userId: z.string().uuid(),
    provider: z.string().regex(/^[a-z0-9_-]{2,40}$/),
    brandId: z.string().uuid().nullish(),
    redirectUri: z.string().url(),
    nonce: z.string().regex(/^[a-f0-9]{32}$/),
    exp: z.number().int().positive(),
  })
  .strict();
export type StatePayload = z.infer<typeof StateSchema>;

function key(): Buffer {
  const raw = process.env.OAUTH_TOKEN_ENC_KEY;
  if (!raw) throw new Error("OAUTH_TOKEN_ENC_KEY is not configured");
  const result = Buffer.from(raw, "base64");
  if (result.length !== 32) throw new Error("OAuth state requires a 32-byte key");
  return result;
}
function signature(body: string) {
  return createHmac("sha256", key())
    .update("velt/oauth/state/v1:")
    .update(body)
    .digest("base64url");
}
export function stateCookieName(provider: string) {
  if (!/^[a-z0-9_-]{2,40}$/.test(provider)) throw new Error("Invalid OAuth provider");
  return `velt_oauth_${provider}`;
}
export function stateCookieValue(state: string) {
  return createHash("sha256").update(state).digest("hex");
}
export function stateMatchesCookie(state: string, value: string | undefined) {
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return false;
  return timingSafeEqual(Buffer.from(stateCookieValue(state)), Buffer.from(value));
}
export function signState(input: Omit<StatePayload, "nonce" | "exp">): string {
  const payload = StateSchema.parse({
    ...input,
    nonce: randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  });
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signature(body)}`;
}
export function verifyState(token: string): StatePayload {
  if (token.length > 4096) throw new Error("Malformed OAuth state");
  const pieces = token.split(".");
  if (pieces.length !== 2 || pieces.some((piece) => !/^[A-Za-z0-9_-]+$/.test(piece)))
    throw new Error("Malformed OAuth state");
  const [body, mac] = pieces;
  const expected = signature(body);
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected)))
    throw new Error("OAuth state signature mismatch");
  const payload = StateSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now || payload.exp > now + STATE_TTL_SECONDS)
    throw new Error("OAuth state expired or invalid");
  const redirect = new URL(payload.redirectUri);
  if (!["https:", "http:"].includes(redirect.protocol) || redirect.username || redirect.password)
    throw new Error("Invalid OAuth redirect");
  return payload;
}
