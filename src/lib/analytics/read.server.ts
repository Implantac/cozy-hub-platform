import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { readAllPages } from "@/lib/api/_pagination";
import type { Snapshot } from "./snapshots";

/** Caller-scoped, stable pagination. Service-role is never used to assemble a user's report. */
export function readSnapshotWindow(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  window: { start: string; end: string },
): Promise<Snapshot[]> {
  return readAllPages((from, to) =>
    supabase
      .from("analytics_snapshots")
      .select(
        "id, content_id, channel_id, captured_at, metrics, channel:channels(platform), content:content(title)",
      )
      .eq("workspace_id", workspaceId)
      .gte("captured_at", window.start)
      .lt("captured_at", window.end)
      .order("captured_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
}
