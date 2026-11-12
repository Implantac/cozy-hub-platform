import { useTranslation } from "react-i18next";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SectionCard } from "@/components/app/SectionCard";
import { PLATFORM_RULES, type PlatformId } from "@/lib/growth/platform-rules";
import { formatMetric } from "@/lib/analytics/presentation";
import { TOOLTIP_STYLE } from "../constants";

export type PlatformImpressions = { platform: string; impressions: number };

export function PlatformImpressionsChart({ byPlatform }: { byPlatform: PlatformImpressions[] }) {
  const { t, i18n } = useTranslation();
  const items = byPlatform.map((item) => ({
    ...item,
    label:
      PLATFORM_RULES[item.platform as PlatformId]?.label ??
      (item.platform === "other" ? t("analytics.otherPlatform") : item.platform),
  }));
  return (
    <SectionCard title={t("analytics.platformImpressions")} icon={BarChart3}>
      <div className="h-64" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={items} accessibilityLayer={false}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar
              dataKey="impressions"
              name={t("analytics.impressions")}
              fill="var(--primary)"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 rounded-lg border border-border/60 px-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
          {t("analytics.platformTableSummary")}
        </summary>
        <div className="overflow-x-auto pb-3">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("analytics.platformImpressions")}</caption>
            <thead>
              <tr>
                <th scope="col" className="py-2 pr-3">
                  {t("analytics.platform")}
                </th>
                <th scope="col" className="py-2 text-right">
                  {t("analytics.impressions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.platform} className="border-t border-border/40">
                  <th scope="row" className="py-2 pr-3 font-normal">
                    {item.label}
                  </th>
                  <td className="py-2 text-right tabular-nums">
                    {formatMetric(item.impressions, i18n.language)}
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
