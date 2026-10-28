/**
 * VELT — Weekly report data assembly.
 *
 * Turns a week of workspace activity into the numbers that go on the PDF. Kept
 * separate from both the database and the renderer:
 *
 *   - `buildReportData(rows)` is a pure function over already-fetched rows, so
 *     the comparisons and the "what changed" logic are testable without a
 *     database or a PDF.
 *   - `report.server.ts` fetches, this file computes, `render.ts` draws.
 *
 * The organising question is not "what can we show?" but "what did this week
 * change?". A report that lists totals without a comparison is a dashboard
 * screenshot; the reason someone opens a weekly PDF is to see movement.
 */

import type { CanonicalMetrics } from "@/lib/analytics/normalize";

export interface ReportWindow {
  start: string; // ISO, inclusive
  end: string; // ISO, exclusive
}

export interface PublishedPost {
  contentId: string;
  title: string | null;
  platform: string;
  publishedAt: string;
}

export interface PostMetrics {
  contentId: string;
  metrics: Partial<CanonicalMetrics>;
}

export interface MetricMovement {
  key: keyof CanonicalMetrics;
  label: string;
  current: number;
  previous: number;
  /** Relative change. `null` when the previous value was zero — there is no
   *  meaningful percentage from nothing, and "∞%" is not a number a person reads. */
  deltaPct: number | null;
  direction: "up" | "down" | "flat";
}

export interface ChannelLine {
  platform: string;
  published: number;
  engagement: number;
  impressions: number;
  /** Engagement per impression, as a percentage. */
  rate: number;
}

export interface WeeklyReportData {
  window: ReportWindow;
  previousWindow: ReportWindow;
  workspaceName: string;
  publishedCount: number;
  previousPublishedCount: number;
  movements: MetricMovement[];
  channels: ChannelLine[];
  topPosts: Array<{ title: string; platform: string; engagement: number; rate: number }>;
  /** Human sentences generated from the data, never from a model. */
  highlights: string[];
  /** True when the workspace had no activity at all — the report must say so. */
  empty: boolean;
  generatedAt: string;
}

const METRIC_LABELS: Partial<Record<keyof CanonicalMetrics, string>> = {
  impressions: "Impressões",
  reach: "Alcance",
  engagement: "Engajamento",
  likes: "Curtidas",
  comments: "Comentários",
  shares: "Compartilhamentos",
  saves: "Salvamentos",
  clicks: "Cliques",
  followers: "Seguidores",
  engagement_rate: "Taxa de engajamento",
};

/** Sums a metrics payload, treating missing fields as zero. */
export function sumMetrics(items: PostMetrics[]): CanonicalMetrics {
  const acc: CanonicalMetrics = {
    impressions: 0,
    reach: 0,
    engagement: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    clicks: 0,
    video_views: 0,
    followers: 0,
    engagement_rate: 0,
  };
  for (const item of items) {
    for (const [k, v] of Object.entries(item.metrics)) {
      const key = k as keyof CanonicalMetrics;
      if (typeof v === "number" && Number.isFinite(v)) acc[key] += v;
    }
  }
  // Rate is derived, never summed: adding two percentages is meaningless.
  const denominator = acc.impressions || acc.reach;
  acc.engagement_rate =
    denominator > 0 ? Math.round((acc.engagement / denominator) * 10000) / 10000 : 0;
  return acc;
}

export function compareMetrics(
  current: CanonicalMetrics,
  previous: CanonicalMetrics,
): MetricMovement[] {
  const keys: Array<keyof CanonicalMetrics> = [
    "impressions",
    "reach",
    "engagement",
    "saves",
    "shares",
    "clicks",
  ];

  return keys.map((key) => {
    const cur = current[key] ?? 0;
    const prev = previous[key] ?? 0;
    const deltaPct = prev === 0 ? null : Math.round(((cur - prev) / prev) * 1000) / 10;
    const direction = cur === prev ? "flat" : cur > prev ? "up" : "down";
    return {
      key,
      label: METRIC_LABELS[key] ?? String(key),
      current: cur,
      previous: prev,
      deltaPct,
      direction,
    };
  });
}

/**
 * Builds the report payload.
 *
 * `now` and the window boundaries are injected so the whole function is
 * deterministic in tests — a weekly report that cannot be regenerated
 * identically is impossible to verify.
 */
export function buildReportData(input: {
  workspaceName: string;
  window: ReportWindow;
  previousWindow: ReportWindow;
  published: PublishedPost[];
  metricsCurrent: PostMetrics[];
  metricsPrevious: PostMetrics[];
  now?: string;
}): WeeklyReportData {
  const current = sumMetrics(input.metricsCurrent);
  const previous = sumMetrics(input.metricsPrevious);
  const movements = compareMetrics(current, previous);

  const channels = buildChannelLines(input.published, input.metricsCurrent);

  const metricsByContent = new Map(input.metricsCurrent.map((m) => [m.contentId, m]));
  const topPosts = input.published
    .map((p) => {
      const m = metricsByContent.get(p.contentId)?.metrics ?? {};
      const engagement = Number(m.engagement ?? 0);
      const denom = Number(m.impressions ?? m.reach ?? 0);
      return {
        title: p.title?.trim() || "Post sem título",
        platform: p.platform,
        engagement,
        rate: denom > 0 ? Math.round((engagement / denom) * 10000) / 10000 : 0,
      };
    })
    .filter((p) => p.engagement > 0)
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 3);

  const empty =
    input.published.length === 0 &&
    input.metricsCurrent.length === 0 &&
    input.metricsPrevious.length === 0;

  const highlights = buildHighlights({
    publishedCount: input.published.length,
    previousPublishedCount: input.previousWindow
      ? countInWindow(input.published, input.previousWindow)
      : 0,
    movements,
    current,
    channels,
  });

  return {
    window: input.window,
    previousWindow: input.previousWindow,
    workspaceName: input.workspaceName,
    publishedCount: countInWindow(input.published, input.window),
    previousPublishedCount: countInWindow(input.published, input.previousWindow),
    movements,
    channels,
    topPosts,
    highlights,
    empty,
    generatedAt: input.now ?? new Date().toISOString(),
  };
}

function countInWindow(posts: PublishedPost[], window: ReportWindow): number {
  const start = Date.parse(window.start);
  const end = Date.parse(window.end);
  return posts.filter((p) => {
    const t = Date.parse(p.publishedAt);
    return Number.isFinite(t) && t >= start && t < end;
  }).length;
}

function buildChannelLines(published: PublishedPost[], metrics: PostMetrics[]): ChannelLine[] {
  const byPlatform = new Map<string, { published: number; ids: Set<string> }>();

  for (const p of published) {
    const entry = byPlatform.get(p.platform) ?? { published: 0, ids: new Set<string>() };
    entry.published += 1;
    entry.ids.add(p.contentId);
    byPlatform.set(p.platform, entry);
  }

  const lines: ChannelLine[] = [];
  for (const [platform, entry] of byPlatform) {
    const relevant = metrics.filter((m) => entry.ids.has(m.contentId));
    const total = sumMetrics(relevant);
    lines.push({
      platform,
      published: entry.published,
      engagement: total.engagement,
      impressions: total.impressions,
      rate: total.engagement_rate,
    });
  }

  return lines.sort((a, b) => b.engagement - a.engagement);
}

/**
 * Turns numbers into sentences. Deterministic on purpose: a PDF that arrives by
 * email cannot be re-read in context, so every claim has to be literally true
 * of the data printed next to it.
 */
function buildHighlights(input: {
  publishedCount: number;
  previousPublishedCount: number;
  movements: MetricMovement[];
  current: CanonicalMetrics;
  channels: ChannelLine[];
}): string[] {
  const out: string[] = [];

  if (input.publishedCount === 0) {
    out.push("Nenhuma publicação nesta semana — o relatório mede o que já está no ar.");
  } else if (input.publishedCount > input.previousPublishedCount) {
    out.push(
      `Você publicou ${input.publishedCount} vez(es), contra ${input.previousPublishedCount} na semana anterior.`,
    );
  } else if (input.publishedCount < input.previousPublishedCount) {
    out.push(
      `Você publicou ${input.publishedCount} vez(es), menos que as ${input.previousPublishedCount} da semana anterior.`,
    );
  } else {
    out.push(`Cadência estável: ${input.publishedCount} publicação(ões), igual à semana anterior.`);
  }

  const engagement = input.movements.find((m) => m.key === "engagement");
  if (engagement && engagement.direction !== "flat" && engagement.deltaPct !== null) {
    const verb = engagement.direction === "up" ? "subiu" : "caiu";
    out.push(
      `O engajamento ${verb} ${Math.abs(engagement.deltaPct)}% em relação à semana anterior.`,
    );
  } else if (engagement && engagement.previous === 0 && engagement.current > 0) {
    out.push("Primeira semana com engajamento medido — não há base de comparação ainda.");
  }

  if (input.channels.length > 0) {
    const best = input.channels[0];
    if (best.engagement > 0) {
      out.push(`O canal que mais engajou foi ${best.platform}, com ${best.engagement} interações.`);
    }
  }

  if (input.current.impressions === 0 && input.current.reach === 0) {
    out.push(
      "Sem impressões coletadas nesta semana. Se as publicações saíram, vale conferir a conexão do canal em Canais.",
    );
  }

  return out;
}

/** Default windows: the last 7 days, and the 7 before that. */
export function defaultWindows(now: Date = new Date()): {
  window: ReportWindow;
  previousWindow: ReportWindow;
} {
  const end = new Date(now);
  const start = new Date(end.getTime() - 7 * 86_400_000);
  const prevEnd = start;
  const prevStart = new Date(prevEnd.getTime() - 7 * 86_400_000);
  return {
    window: { start: start.toISOString(), end: end.toISOString() },
    previousWindow: { start: prevStart.toISOString(), end: prevEnd.toISOString() },
  };
}

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

/**
 * CSV companion to the PDF.
 *
 * The PDF is for reading; the CSV is for proving. Anyone who wants to check the
 * report's arithmetic should not have to retype numbers out of a PDF — and the
 * data is the workspace's own.
 */
export function reportToCsv(data: WeeklyReportData): string {
  const escape = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows: string[] = [];

  rows.push("secao,metrica,valor_semana,valor_semana_anterior,variacao_pct");
  for (const m of data.movements) {
    rows.push(
      [
        "metrica",
        escape(m.label),
        m.current,
        m.previous,
        m.deltaPct === null ? "" : m.deltaPct,
      ].join(","),
    );
  }

  rows.push("");
  rows.push("secao,canal,publicacoes,engajamento,impressoes,taxa");
  for (const c of data.channels) {
    rows.push(
      ["canal", escape(c.platform), c.published, c.engagement, c.impressions, c.rate].join(","),
    );
  }

  rows.push("");
  rows.push("secao,titulo,canal,engajamento,taxa");
  for (const p of data.topPosts) {
    rows.push(["post", escape(p.title), escape(p.platform), p.engagement, p.rate].join(","));
  }

  return rows.join("\n");
}
