import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { createI18nInstance, type LanguageCode } from "@/lib/i18n";
import { PeriodTabs } from "../components/PeriodTabs";
import { EngagementTrendChart } from "../components/EngagementTrendChart";
import { PlatformImpressionsChart } from "../components/PlatformImpressionsChart";

function render(language: LanguageCode, node: ReturnType<typeof createElement>) {
  return renderToStaticMarkup(
    createElement(I18nextProvider, { i18n: createI18nInstance(language) }, node),
  );
}

describe("accessible analytics data", () => {
  it("uses real radios instead of a tablist without panels or keyboard behavior", () => {
    const html = render("pt-BR", createElement(PeriodTabs, { days: 30, onChange: () => {} }));
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain("<legend");
    expect(html).toContain("Últimos 30 dias");
    expect(html).not.toContain('role="tab"');
  });
  it("provides a keyboard-expandable table with the exact engagement values", () => {
    const html = render(
      "en-US",
      createElement(EngagementTrendChart, { daily: [{ date: "2026-11-12", engagement: 1234 }] }),
    );
    expect(html).toContain("<details");
    expect(html).toContain("View engagement as a table");
    expect(html).toContain('<time dateTime="2026-11-12">Nov 12</time>');
    expect(html).toContain("1,234");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
  });
  it("labels platform data without inventing totals or replacing an unknown platform", () => {
    const html = render(
      "pt-BR",
      createElement(PlatformImpressionsChart, {
        byPlatform: [
          { platform: "instagram", impressions: 1234 },
          { platform: "unknown-platform", impressions: 0 },
        ],
      }),
    );
    expect(html).toContain("Ver impressões em tabela");
    expect(html).toContain("Instagram");
    expect(html).toContain("unknown-platform");
    expect(html).toContain("1.234");
  });
});
