import type { Database } from "@/integrations/supabase/types";
/**
 * USE Brain — shared types.
 * BrainContext is the consolidated view of the workspace that every engine reads.
 */

export type BrainQuestion =
  "where_am_i" | "where_to_go" | "whats_blocking" | "next_action" | "should_pivot";

export type BrainEventKind = "decision" | "result" | "pivot" | "signal" | "reflection";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface BrainSignal {
  engine: string;
  kind: "positive" | "negative" | "neutral";
  severity: Severity;
  message: string;
  weight: number; // 0..1
}

export interface BrainAction {
  title: string;
  rationale?: string;
  href?: string;
  score: number; // 0..100 priority
  engine: string;
}

export interface EngineReport {
  scores?: Record<string, number>;
  signals: BrainSignal[];
  actions: BrainAction[];
  facts?: Record<string, unknown>;
}

/**
 * Raw data slices, typed from the generated schema.
 *
 * `any` here was not free: every engine read arbitrary fields off these slices,
 * so a column renamed in the database (or a field that never existed) surfaced as
 * `undefined` at runtime instead of as a compile error. Deriving the types from
 * `Database` moves that whole class of bug to the build.
 */
export type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

/**
 * Three slices are loaded with a projection instead of `*`, because the engines
 * only read a handful of columns and pulling every post body for 500 rows is
 * waste. Declaring the projection is what keeps it honest — see the note on
 * `analytics` below for what happens when the two drift apart.
 */
export type ContentSlice = Pick<Row<"content">, "id" | "status" | "created_at" | "title">;
export type JobSlice = Pick<Row<"scheduler_jobs">, "id" | "status" | "scheduled_at" | "content_id">;
export type AnalyticsSlice = Pick<
  Row<"analytics_snapshots">,
  "id" | "metrics" | "captured_at" | "content_id"
>;

export interface BrainContext {
  workspaceId: string;
  userId: string;
  // Raw data slices
  profile: Row<"user_profile_digital"> | null;
  workspace: Row<"workspaces"> | null;
  brands: Row<"brands">[];
  channels: Row<"channels">[];
  content: ContentSlice[];
  jobs: JobSlice[];
  /**
   * `content_id` is not optional here.
   *
   * The growth engine groups snapshots by `content_id` to find the latest
   * metrics per post. The query used to select `id, metrics, captured_at` — so
   * every `content_id` was `undefined` and the grouping map stayed empty, which
   * silently made "best time to post" fall back to baselines forever. The fix
   * for that had already been written; the column it depends on was never
   * fetched, and `any[]` meant nothing complained.
   */
  analytics: AnalyticsSlice[];
  opportunities: Row<"opportunities">[];
  memory: Row<"brain_memory_events">[]; // recent
  blueprint: Row<"business_blueprints"> | null; // 10 blocks
  competitors: Row<"competitors">[]; // radar
  skills: Row<"skill_assessments">[]; // per user
  // Engine reports filled during analyze()
  reports?: Record<string, EngineReport>;
}

export interface BrainSnapshot {
  workspace_id: string;
  snapshot: {
    user: any;
    business: any;
    growth: any;
    market: any;
    opportunity: any;
    trust: any;
    memory_size: number;
  };
  scores: Record<string, number>;
  signals: BrainSignal[];
}

export interface BrainAnswer {
  question: BrainQuestion;
  headline: string;
  body?: string;
  bullets?: string[];
  cta?: { label: string; href: string } | null;
  confidence: number; // 0..1
  supporting?: BrainSignal[];
  /** Brain-3: contextual note from Lovable AI Gateway. */
  aiNote?: string | null;
  /** "rules" (heuristic only) | "ai" (enriched). */
  source?: "rules" | "ai";
}
