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
  channelId?: string;
  title: string | null;
  platform: string;
  publishedAt: string;
}

export interface PostMetrics {
  contentId: string;
  channelId?: string;
  platform?: string;
  title?: string | null;
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
      if (
        key !== "followers" &&
        key in acc &&
        typeof v === "number" &&
        Number.isFinite(v) &&
        v >= 0
      )
        acc[key] += v;
    }
  }
  const followers = new Map<string, number>();
  for (const item of items) {
    const n = item.metrics.followers;
    if (typeof n === "number" && Number.isFinite(n) && n >= 0)
      followers.set(item.channelId ?? "unknown", n);
  }
  acc.followers = [...followers.values()].reduce((a, b) => a + b, 0);
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

  const publishedCurrent = input.published.filter((p) => inWindow(p, input.window));
  const channels = buildChannelLines(publishedCurrent, input.metricsCurrent);
  const topPosts = input.metricsCurrent
    .map((m) => {
      const post = matchingPost(input.published, m);
      const engagement = metricValue(m.metrics.engagement);
      const denominator = metricValue(m.metrics.impressions) || metricValue(m.metrics.reach);
      return {
        title: m.title?.trim() || post?.title?.trim() || "Post sem título",
        platform: m.platform ?? post?.platform ?? "desconhecido",
        engagement,
        rate: denominator > 0 ? Math.round((engagement / denominator) * 10_000) / 100 : 0,
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
    publishedCount: publishedCurrent.length,
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

function metricValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
function inWindow(post: PublishedPost, window: ReportWindow) {
  const time = Date.parse(post.publishedAt);
  return Number.isFinite(time) && time >= Date.parse(window.start) && time < Date.parse(window.end);
}
function countInWindow(posts: PublishedPost[], window: ReportWindow): number {
  return posts.filter((post) => inWindow(post, window)).length;
}
function matchingPost(posts: PublishedPost[], metric: PostMetrics) {
  return posts.find(
    (post) =>
      post.contentId === metric.contentId &&
      (!metric.channelId || post.channelId === metric.channelId),
  );
}
function buildChannelLines(published: PublishedPost[], metrics: PostMetrics[]): ChannelLine[] {
  const lines = new Map<string, ChannelLine>();
  const get = (platform: string) => {
    const line = lines.get(platform) ?? {
      platform,
      published: 0,
      engagement: 0,
      impressions: 0,
      rate: 0,
    };
    lines.set(platform, line);
    return line;
  };
  for (const post of published) get(post.platform).published++;
  for (const metric of metrics) {
    const platform = metric.platform ?? matchingPost(published, metric)?.platform ?? "desconhecido";
    const line = get(platform);
    line.engagement += metricValue(metric.metrics.engagement);
    line.impressions += metricValue(metric.metrics.impressions);
  }
  for (const line of lines.values())
    line.rate =
      line.impressions > 0 ? Math.round((line.engagement / line.impressions) * 10_000) / 100 : 0;
  return [...lines.values()].sort(
    (a, b) => b.engagement - a.engagement || a.platform.localeCompare(b.platform),
  );
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
  const out: string[] = [
    "Métricas acumuladas: última coleta de cada publicação por canal na semana. Coletas repetidas não são somadas; alcance agregado não representa pessoas únicas.",
  ];

  const measurementNote = out.pop()!;
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
      `O engajamento acumulado observado ${verb} ${Math.abs(engagement.deltaPct)}% frente à coleta da semana anterior; isso não mede apenas interações da semana.`,
    );
  } else if (engagement && engagement.previous === 0 && engagement.current > 0) {
    out.push(
      "Primeira semana com engajamento acumulado observado — não há base de comparação ainda.",
    );
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

  out.push(measurementNote);
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
  const escape = (raw: string) => {
    // Prevent a title/handle from becoming a formula when opened in a spreadsheet.
    const value = /^[\s]*[=+@-]/.test(raw) || /^[\t\r]/.test(raw) ? "'" + raw : raw;
    return /[",\n;\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
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

  rows.push(
    "",
    "secao,base_metrica",
    "metodologia,acumulado da ultima coleta por publicacao e canal; nao representa apenas interacoes ocorridas na semana",
  );
  return rows.join("\n");
}
