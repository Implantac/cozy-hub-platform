import { TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SectionCard } from "@/components/app/SectionCard";
import { TOOLTIP_STYLE } from "../constants";

/**
 * The series this chart renders. Declared from the `dataKey`s below, so a change
 * to the aggregator that renames or drops one becomes a compile error instead of
 * an empty chart that nobody notices.
 */
export type DailyPoint = { date: string; engagement: number };

export function EngagementTrendChart({ daily }: { daily: DailyPoint[] }) {
  return (
    <SectionCard title="Tendência de engajamento" icon={TrendingUp}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={daily}>
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area
              type="monotone"
              dataKey="engagement"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#g1)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
