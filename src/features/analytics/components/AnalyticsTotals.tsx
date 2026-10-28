import { Eye, Heart, TrendingUp, Users } from "lucide-react";
import { StatTile } from "@/components/app/StatTile";

type Totals = { impressions: number; engagement: number; reach: number; posts: number };

export function AnalyticsTotals({ totals }: { totals: Totals }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <StatTile icon={Eye} label="Impressões" value={totals.impressions.toLocaleString()} />
      <StatTile icon={Heart} label="Engajamento" value={totals.engagement.toLocaleString()} />
      <StatTile icon={Users} label="Alcance" value={totals.reach.toLocaleString()} />
      <StatTile
        icon={TrendingUp}
        label="Snapshots"
        value={totals.posts.toLocaleString()}
        emphasis
      />
    </div>
  );
}
