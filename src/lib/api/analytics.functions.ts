import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireWorkspaceRole } from "./_workspace";
import { readSnapshotWindow } from "@/lib/analytics/read.server";
import { aggregateSnapshots } from "@/lib/analytics/snapshots";

/** Latest cumulative metrics per post AND channel, never sums of repeated collections. */
export const getAnalyticsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        days: z.number().int().min(7).max(180).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireWorkspaceRole(supabase, data.workspaceId, userId);
    const end = new Date();
    const rows = await readSnapshotWindow(supabase, data.workspaceId, {
      start: new Date(end.getTime() - data.days * 86400_000).toISOString(),
      end: end.toISOString(),
    });
    return aggregateSnapshots(rows);
  });
