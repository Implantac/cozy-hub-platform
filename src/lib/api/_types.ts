/**
 * Centralized type aliases derived directly from the Supabase generated schema.
 *
 * We intentionally avoid `Awaited<ReturnType<serverFn>>` because the
 * server-function wrappers produced by `createServerFn` expose opaque
 * return types — extracting them yields `never`. Pulling from the
 * generated `Database` types keeps a single source of truth without
 * paying that cost.
 */
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type Brand = Tables["brands"]["Row"];
export type Mission = Tables["missions"]["Row"];
export type Recommendation = Tables["brain_recommendations"]["Row"];

/** Channel rows are returned with a joined brand name. */
export type Channel = Tables["channels"]["Row"] & {
  brand: { name: string } | null;
};

/** Content rows are returned with a joined brand name. */
export type Content = Tables["content"]["Row"] & {
  brand: { name: string } | null;
};

/** The memory listing endpoint returns a projected subset of the row. */
export type Memory = Pick<
  Tables["brain_memories"]["Row"],
  "id" | "kind" | "content" | "metadata" | "created_at"
>;

/** Scheduler jobs are returned with joined content + channel summary. */
export type SchedulerJob = Tables["scheduler_jobs"]["Row"] & {
  content: { title: string | null; type: string } | null;
  channel: { platform: string; name?: string | null } | null;
};
