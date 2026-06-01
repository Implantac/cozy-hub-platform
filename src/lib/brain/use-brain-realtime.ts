import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to brain_snapshots / brain_answers / brain_memory_events for a workspace
 * and invalidates the relevant React Query caches when changes arrive.
 */
export function useBrainRealtime(workspaceId: string | null | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;
    const filter = `workspace_id=eq.${workspaceId}`;
    const channel = supabase
      .channel(`brain-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "brain_snapshots", filter }, () => {
        qc.invalidateQueries({ queryKey: ["brain-all", workspaceId] });
        qc.invalidateQueries({ queryKey: ["score", workspaceId] });
        qc.invalidateQueries({ queryKey: ["health", workspaceId] });
        qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "brain_answers", filter }, () => {
        qc.invalidateQueries({ queryKey: ["brain-all", workspaceId] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "brain_memory_events", filter }, () => {
        qc.invalidateQueries({ queryKey: ["coach-timeline", workspaceId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "coach_recommendations", filter }, () => {
        qc.invalidateQueries({ queryKey: ["recs", workspaceId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, qc]);
}
