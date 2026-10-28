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

export interface BrainContext {
  workspaceId: string;
  userId: string;
  // Raw data slices
  profile: any | null; // user_profile_digital
  workspace: any | null;
  brands: any[];
  channels: any[];
  content: any[];
  jobs: any[];
  analytics: any[];
  opportunities: any[];
  memory: any[]; // brain_memory_events (recent)
  blueprint: any | null; // business_blueprints (10 blocks)
  competitors: any[]; // competitors radar
  skills: any[]; // skill_assessments (per user)
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
