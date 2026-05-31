/**
 * Server-only OAuth token store. RLS denies all client access to oauth_tokens;
 * every read/write here goes through supabaseAdmin and the AES-GCM crypto layer.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken, encryptToken } from "./crypto.server";

export interface StoredToken {
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string | null;
  scope?: string | null;
  expiresAt?: string | null;
}

export async function saveToken(channelId: string, t: StoredToken): Promise<void> {
  const row = {
    channel_id: channelId,
    access_token_ciphertext: encryptToken(t.accessToken),
    refresh_token_ciphertext: t.refreshToken ? encryptToken(t.refreshToken) : null,
    token_type: t.tokenType ?? null,
    scope: t.scope ?? null,
    expires_at: t.expiresAt ?? null,
  };
  const { error } = await supabaseAdmin
    .from("oauth_tokens")
    .upsert(row, { onConflict: "channel_id" });
  if (error) throw new Error(`saveToken: ${error.message}`);
}

export async function getToken(channelId: string): Promise<StoredToken | null> {
  const { data, error } = await supabaseAdmin
    .from("oauth_tokens")
    .select("*")
    .eq("channel_id", channelId)
    .maybeSingle();
  if (error) throw new Error(`getToken: ${error.message}`);
  if (!data) return null;
  return {
    accessToken: decryptToken(data.access_token_ciphertext),
    refreshToken: data.refresh_token_ciphertext
      ? decryptToken(data.refresh_token_ciphertext)
      : null,
    tokenType: data.token_type,
    scope: data.scope,
    expiresAt: data.expires_at,
  };
}

export async function deleteToken(channelId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("oauth_tokens")
    .delete()
    .eq("channel_id", channelId);
  if (error) throw new Error(`deleteToken: ${error.message}`);
}
