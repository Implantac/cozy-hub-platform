import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Domain event names emitted by the application. Keeping them in one place
 * makes it harder to drift the strings across server functions.
 */
export type DomainEventType =
  | "BrandCreated"
  | "ChannelRegistered"
  | "ContentCreated"
  | "MissionAssigned"
  | "BrainRecommendationCreated";

interface RecordDomainEventArgs {
  workspaceId: string;
  eventType: DomainEventType;
  payload?: Record<string, unknown>;
}

/**
 * Insert a row into `domain_events`. Best-effort: failures are not thrown
 * because writing audit records must never block the originating mutation.
 */
export async function recordDomainEvent(
  // The auth-middleware supabase client carries the user context; admin not required.
  supabase: SupabaseClient,
  { workspaceId, eventType, payload = {} }: RecordDomainEventArgs,
): Promise<void> {
  const { error } = await supabase.from("domain_events").insert({
    workspace_id: workspaceId,
    event_type: eventType,
    payload: payload as never,
  });
  if (error) {
    // Log without throwing — caller's primary write already succeeded.
    console.warn("[domain_events] insert failed", { eventType, error: error.message });
  }
}
