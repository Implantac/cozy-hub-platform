/**
 * Memory event emitter — best-effort write to brain_memory_events.
 * Never throws: timeline enrichment must not break the originating mutation.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

export type BrainEventKind = "decision" | "result" | "pivot" | "signal" | "reflection";
export type BrainSentiment = "positive" | "negative" | "neutral";

export interface MemoryEventInput {
  workspaceId: string;
  userId: string;
  kind: BrainEventKind;
  subject: string;
  /**
   * Free-form context stored as JSON. Typed as `Json` rather than
   * `Record<string, unknown>` because the column is JSON: the looser type lets a
   * caller pass a `Date` or a class instance that cannot be serialised, and the
   * insert then fails (or worse, writes `{}` silently).
   */
  payload?: Json;
  sentiment?: BrainSentiment;
}

export async function emitMemoryEvent(
  supabase: SupabaseClient<Database>,
  evt: MemoryEventInput,
): Promise<void> {
  try {
    await supabase.from("brain_memory_events").insert({
      workspace_id: evt.workspaceId,
      user_id: evt.userId,
      kind: evt.kind,
      subject: evt.subject.slice(0, 240),
      payload: evt.payload ?? {},
      sentiment: evt.sentiment ?? "neutral",
    });
  } catch {
    /* timeline writes are best-effort; ignore */
  }
}

/**
 * Invalidate cached Brain answers for a workspace so the next ask recomputes
 * against fresh context. Best-effort; never throws.
 */
export async function invalidateBrainCache(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
): Promise<void> {
  try {
    await supabase.from("brain_answers").delete().eq("workspace_id", workspaceId);
  } catch {
    /* cache invalidation is best-effort; ignore */
  }
}
