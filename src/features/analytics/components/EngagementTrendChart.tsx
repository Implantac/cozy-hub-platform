import { useId } from "react";
import { useTranslation } from "react-i18next";
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
import { formatCollectionDate, formatMetric } from "@/lib/analytics/presentation";
import { TOOLTIP_STYLE } from "../constants";

export type DailyPoint = { date: string; engagement: number };

export function EngagementTrendChart({ daily }: { daily: DailyPoint[] }) {
  const { t, i18n } = useTranslation();
  const gradientId = `engagement-${useId().replace(/:/g, "")}`;
  return (
    <SectionCard title={t("analytics.engagementTrend")} icon={TrendingUp}>
      <div className="h-72" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={daily} accessibilityLayer={false}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickFormatter={(day: string) => formatCollectionDate(day, i18n.language)}
            />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(day) => formatCollectionDate(String(day), i18n.language)}
            />
            <Area
              type="monotone"
              dataKey="engagement"
              name={t("analytics.engagement")}
              stroke="var(--primary)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 rounded-lg border border-border/60 px-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
          {t("analytics.dailyTableSummary")}
        </summary>
        <div className="overflow-x-auto pb-3">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("analytics.engagementTrend")}</caption>
            <thead>
              <tr>
                <th scope="col" className="py-2 pr-3">
                  {t("analytics.collectionDate")}
                </th>
                <th scope="col" className="py-2 text-right">
                  {t("analytics.engagement")}
                </th>
              </tr>
            </thead>
            <tbody>
              {daily.map((point) => (
                <tr key={point.date} className="border-t border-border/40">
                  <th scope="row" className="py-2 pr-3 font-normal">
                    <time dateTime={point.date}>
                      {formatCollectionDate(point.date, i18n.language)}
                    </time>
                  </th>
                  <td className="py-2 text-right tabular-nums">
                    {formatMetric(point.engagement, i18n.language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </SectionCard>
  );
}
