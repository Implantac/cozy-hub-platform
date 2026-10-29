import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SectionCard } from "@/components/app/SectionCard";
import { TOOLTIP_STYLE } from "../constants";

/** See the note on `DailyPoint`: the shape is the chart's own contract. */
export type PlatformImpressions = { platform: string; impressions: number };

export function PlatformImpressionsChart({ byPlatform }: { byPlatform: PlatformImpressions[] }) {
  return (
    <SectionCard title="Impressões por plataforma" icon={BarChart3}>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byPlatform}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="platform" stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="impressions" fill="var(--primary)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
