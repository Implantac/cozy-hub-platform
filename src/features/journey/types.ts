export type Period = {
  key: string; year: number; quarter: number;
  starts_at: string; ends_at: string;
  events_count: number; decisions_count: number; experiments_count: number;
  wins: string[]; setbacks: string[];
  score_avg: number | null;
  highlights: string[]; narrative: string;
};

export type Mentor = {
  periods_tracked: number; total_events: number; total_decisions: number;
  completed_experiments: number; trajectory_delta: number | null;
  verdict: string; patterns: string[];
};
