export type Competitor = {
  id: string; workspace_id: string;
  name: string; handle: string | null;
  followers: number; engagement: number;
  trend: "up" | "down" | "flat";
  threat: "high" | "medium" | "low";
  positioning: string | null; recent_move: string | null; gap: string | null;
};

export type CompetitorInput = {
  name: string;
  handle?: string;
  followers?: number;
  engagement?: number;
  trend?: Competitor["trend"];
  threat?: Competitor["threat"];
  positioning?: string;
  recent_move?: string;
  gap?: string;
};
