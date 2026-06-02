export type TrustChecks = {
  trust_signals?: string[];
  red_flags?: string[];
  questions_to_ask?: string[];
  recommendation?: string;
};

export type BuyChecks = {
  value_for_money?: number;
  promise_realism?: number;
  hidden_costs?: string[];
  comparison_alternatives?: string[];
  questions_for_seller?: string[];
  red_flags?: string[];
  green_flags?: string[];
  final_recommendation?: string;
};

export type TrustResult<Checks> = {
  risk_score: number;
  verdict: string;
  summary?: string | null;
  checks?: Checks;
};

export type TrustReportRow = {
  id: string;
  target_name: string;
  target_type: string;
  risk_score: number;
  verdict: string;
  summary?: string | null;
  source_url?: string | null;
  created_at: string;
};

export type TargetType =
  | "instagram"
  | "youtube"
  | "tiktok"
  | "website"
  | "course"
  | "supplier"
  | "person"
  | "other";

export type ResultSection = {
  title: string;
  items: string[];
  tone: "good" | "bad" | "neutral";
};
