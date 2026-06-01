/**
 * Memory event emitter — best-effort write to brain_memory_events.
 * Never throws: timeline enrichment must not break the originating mutation.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type BrainEventKind = "decision" | "result" | "pivot" | "signal" | "reflection";
export type BrainSentiment = "positive" | "negative" | "neutral";

export interface MemoryEventInput {
  workspaceId: string;
  userId: string;
  kind: BrainEventKind;
  subject: string;
  payload?: Record<string, unknown>;
  sentiment?: BrainSentiment;
}

export async function emitMemoryEvent(
  supabase: SupabaseClient<any>,
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
  supabase: SupabaseClient<any>,
  workspaceId: string,
): Promise<void> {
  try {
    await supabase.from("brain_answers").delete().eq("workspace_id", workspaceId);
  } catch {
    /* cache invalidation is best-effort; ignore */
  }
}
