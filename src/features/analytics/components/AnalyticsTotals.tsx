import { useTranslation } from "react-i18next";
import { Eye, Heart, TrendingUp, Users } from "lucide-react";
import { StatTile } from "@/components/app/StatTile";
import { formatMetric } from "@/lib/analytics/presentation";

type Totals = { impressions: number; engagement: number; reach: number; posts: number };

export function AnalyticsTotals({ totals }: { totals: Totals }) {
  const { t, i18n } = useTranslation();
  const number = (value: number) => formatMetric(value, i18n.language);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile icon={Eye} label={t("analytics.impressions")} value={number(totals.impressions)} />
      <StatTile icon={Heart} label={t("analytics.engagement")} value={number(totals.engagement)} />
      <StatTile icon={Users} label={t("analytics.reach")} value={number(totals.reach)} />
      <StatTile
        icon={TrendingUp}
        label={t("analytics.snapshots")}
        value={number(totals.posts)}
        emphasis
      />
    </div>
  );
}
