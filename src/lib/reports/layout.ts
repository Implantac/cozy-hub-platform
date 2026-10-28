/**
 * VELT — Weekly report layout (pure).
 *
 * Produces a flat list of drawing operations; it does not touch PDF bytes. The
 * split exists because the first version drew while it laid out, and that made
 * the two things that actually matter untestable:
 *
 *   1. **Pagination.** Text drawn past the bottom margin disappears silently —
 *      no exception, no warning, just a shorter report.
 *   2. **Content.** Once a PDF is written, its streams are Flate-compressed, so a
 *      test cannot assert that the totals reached the page.
 *
 * Here, both are plain arrays. `render.ts` executes the operations with pdf-lib
 * and owns nothing else.
 *
 * Measurement is injected (`measure`) so this module stays free of font
 * dependencies: the renderer passes the real embedded font, tests pass an
 * approximation. Only wrapping and line-counting depend on it.
 */

import type { WeeklyReportData } from "./weekly";

export const PAGE_W = 595.28; // A4 points
export const PAGE_H = 841.89;
export const MARGIN = 48;
export const FOOTER_RESERVE = 28;

export type ColorName = "ink" | "muted" | "rule" | "brand" | "positive" | "negative";

export type DrawOp =
  | {
      kind: "text";
      page: number;
      x: number;
      y: number;
      text: string;
      size: number;
      bold: boolean;
      color: ColorName;
    }
  | {
      kind: "rect";
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
      fill?: ColorName;
      stroke?: ColorName;
    }
  | { kind: "line"; page: number; x1: number; y1: number; x2: number; y2: number }
  | { kind: "circle"; page: number; x: number; y: number; radius: number; color: ColorName };

export type Measure = (text: string, size: number) => number;

/** Rough Helvetica width, used by tests. ~0.52 em average for Latin text. */
export const measureApprox: Measure = (text, size) => text.length * size * 0.52;

interface Cursor {
  page: number;
  y: number;
  ops: DrawOp[];
}

export interface LayoutResult {
  ops: DrawOp[];
  pageCount: number;
}

export function layoutWeeklyReport(
  data: WeeklyReportData,
  meta: { workspaceName: string },
  measure: Measure,
  opts: { footerText?: string } = {},
): LayoutResult {
  const c: Cursor = { page: 0, y: PAGE_H - MARGIN, ops: [] };

  header(c, data, meta, measure);
  summary(c, data, measure);
  movements(c, data);
  channels(c, data);
  topPosts(c, data, measure);
  highlights(c, data, measure);

  const pageCount = c.page + 1;
  footer(c, pageCount, opts.footerText ?? "");

  return { ops: c.ops, pageCount };
}

/* helpers */

function bottomLimit() {
  return MARGIN + FOOTER_RESERVE;
}

function ensure(c: Cursor, needed: number) {
  if (c.y - needed >= bottomLimit()) return;
  c.page += 1;
  c.y = PAGE_H - MARGIN;
}

function pushText(
  c: Cursor,
  text: string,
  o: { x?: number; size?: number; bold?: boolean; color?: ColorName; maxWidth?: number },
  measure: Measure,
) {
  const size = o.size ?? 10;
  const x = o.x ?? MARGIN;
  const maxWidth = o.maxWidth ?? PAGE_W - MARGIN * 2;

  for (const line of wrap(text, size, maxWidth, measure)) {
    ensure(c, size * 1.6);
    c.ops.push({
      kind: "text",
      page: c.page,
      x,
      y: c.y,
      text: line,
      size,
      bold: o.bold ?? false,
      color: o.color ?? "ink",
    });
    c.y -= size * 1.35;
  }
}

function pushRule(c: Cursor, gap = 8) {
  c.ops.push({
    kind: "line",
    page: c.page,
    x1: MARGIN,
    y1: c.y + 4,
    x2: PAGE_W - MARGIN,
    y2: c.y + 4,
  });
  c.y -= gap;
}

function sectionTitle(c: Cursor, title: string, measure: Measure) {
  ensure(c, 40);
  c.y -= 6;
  pushText(c, title.toUpperCase(), { size: 8, bold: true, color: "muted" }, measure);
  c.y -= 2;
}

/** Greedy wrap; long tokens are hard-split so nothing can overflow the margin. */
export function wrap(text: string, size: number, maxWidth: number, measure: Measure): string[] {
  const out: string[] = [];
  for (const paragraph of String(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      if (measure(word, size) <= maxWidth) {
        line = word;
        continue;
      }
      let rest = word;
      while (measure(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length;
        while (cut > 1 && measure(rest.slice(0, cut), size) > maxWidth) cut--;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    if (line) out.push(line);
  }
  return out;
}

/* blocks */

function header(
  c: Cursor,
  data: WeeklyReportData,
  meta: { workspaceName: string },
  measure: Measure,
) {
  c.ops.push({
    kind: "rect",
    page: c.page,
    x: 0,
    y: PAGE_H - 6,
    width: PAGE_W,
    height: 6,
    fill: "brand",
  });
  pushText(c, "RELATÓRIO SEMANAL", { size: 8, bold: true, color: "brand" }, measure);
  c.y -= 2;
  pushText(c, meta.workspaceName, { size: 20, bold: true }, measure);
  c.y -= 2;
  pushText(
    c,
    `${fmtDate(data.window.start)} — ${fmtDate(data.window.end)}`,
    {
      size: 10,
      color: "muted",
    },
    measure,
  );
  pushRule(c, 12);
}

function summary(c: Cursor, data: WeeklyReportData, measure: Measure) {
  ensure(c, 90);

  const boxes = [
    {
      label: "PUBLICAÇÕES",
      value: String(data.publishedCount),
      sub: `semana anterior: ${data.previousPublishedCount}`,
    },
    ...data.movements
      .filter((m) => m.key === "impressions" || m.key === "engagement" || m.key === "saves")
      .map((m) => ({
        label: m.label.toUpperCase(),
        value: fmtNumber(m.current),
        sub:
          m.deltaPct === null
            ? m.current > 0
              ? "novo"
              : "—"
            : `${m.deltaPct > 0 ? "+" : ""}${m.deltaPct}% vs. anterior`,
      })),
  ].slice(0, 4);

  const gap = 10;
  const boxW = (PAGE_W - MARGIN * 2 - gap * (boxes.length - 1)) / boxes.length;

  boxes.forEach((b, i) => {
    const x = MARGIN + i * (boxW + gap);
    c.ops.push({
      kind: "rect",
      page: c.page,
      x,
      y: c.y - 54,
      width: boxW,
      height: 54,
      fill: "rule",
      stroke: "rule",
    });
    c.ops.push({
      kind: "text",
      page: c.page,
      x: x + 10,
      y: c.y - 16,
      text: b.label,
      size: 7.5,
      bold: true,
      color: "muted",
    });
    c.ops.push({
      kind: "text",
      page: c.page,
      x: x + 10,
      y: c.y - 34,
      text: b.value,
      size: 16,
      bold: true,
      color: "ink",
    });
    c.ops.push({
      kind: "text",
      page: c.page,
      x: x + 10,
      y: c.y - 46,
      text: b.sub,
      size: 7,
      bold: false,
      color: "muted",
    });
  });

  c.y -= 66;
}

function movements(c: Cursor, data: WeeklyReportData) {
  sectionTitle(c, "Métricas da semana", () => 0);

  const colX = [MARGIN, MARGIN + 200, MARGIN + 300, MARGIN + 400];
  const heads = ["Métrica", "Esta semana", "Anterior", "Variação"];
  heads.forEach((h, i) =>
    c.ops.push({
      kind: "text",
      page: c.page,
      x: colX[i],
      y: c.y,
      text: h,
      size: 8,
      bold: true,
      color: "muted",
    }),
  );
  c.y -= 14;

  for (const m of data.movements) {
    ensure(c, 20);
    c.ops.push({
      kind: "text",
      page: c.page,
      x: colX[0],
      y: c.y,
      text: m.label,
      size: 9.5,
      bold: false,
      color: "ink",
    });
    c.ops.push({
      kind: "text",
      page: c.page,
      x: colX[1],
      y: c.y,
      text: fmtNumber(m.current),
      size: 9.5,
      bold: true,
      color: "ink",
    });
    c.ops.push({
      kind: "text",
      page: c.page,
      x: colX[2],
      y: c.y,
      text: fmtNumber(m.previous),
      size: 9.5,
      bold: false,
      color: "muted",
    });

    const delta =
      m.deltaPct === null
        ? m.current > 0
          ? "novo"
          : "—"
        : `${m.deltaPct > 0 ? "+" : ""}${m.deltaPct}%`;
    c.ops.push({
      kind: "text",
      page: c.page,
      x: colX[3],
      y: c.y,
      text: delta,
      size: 9.5,
      bold: true,
      color: m.direction === "up" ? "positive" : m.direction === "down" ? "negative" : "muted",
    });

    c.y -= 17;
    pushRule(c, 2);
  }
}

function channels(c: Cursor, data: WeeklyReportData) {
  if (data.channels.length === 0) return;
  sectionTitle(c, "Por canal", () => 0);

  for (const ch of data.channels) {
    ensure(c, 24);
    c.ops.push({
      kind: "text",
      page: c.page,
      x: MARGIN,
      y: c.y,
      text: PLATFORM_LABELS[ch.platform] ?? ch.platform,
      size: 9.5,
      bold: true,
      color: "ink",
    });
    c.ops.push({
      kind: "text",
      page: c.page,
      x: MARGIN + 130,
      y: c.y,
      text: `${ch.published} publicaç${ch.published === 1 ? "ão" : "ões"} · ${fmtNumber(ch.engagement)} interações · ${fmtNumber(ch.impressions)} impressões`,
      size: 9,
      bold: false,
      color: "muted",
    });
    c.y -= 17;
    pushRule(c, 2);
  }
}

function topPosts(c: Cursor, data: WeeklyReportData, measure: Measure) {
  if (data.topPosts.length === 0) return;
  sectionTitle(c, "Melhores posts da semana", measure);

  data.topPosts.forEach((p, i) => {
    ensure(c, 34);
    pushText(c, `${i + 1}. ${p.title}`, { size: 9.5, bold: true, maxWidth: 400 }, measure);
    pushText(
      c,
      `${PLATFORM_LABELS[p.platform] ?? p.platform} · ${fmtNumber(p.engagement)} interações`,
      { size: 8.5, color: "muted", maxWidth: 400 },
      measure,
    );
    c.y -= 4;
  });
}

function highlights(c: Cursor, data: WeeklyReportData, measure: Measure) {
  if (data.highlights.length === 0) return;
  sectionTitle(c, "Leitura da semana", measure);

  for (const h of data.highlights) {
    ensure(c, 26);
    c.ops.push({
      kind: "circle",
      page: c.page,
      x: MARGIN + 2,
      y: c.y + 3,
      radius: 1.4,
      color: "brand",
    });
    pushText(c, h, { x: MARGIN + 12, size: 9.5, maxWidth: PAGE_W - MARGIN * 2 - 12 }, measure);
    c.y -= 3;
  }
}

function footer(c: Cursor, pageCount: number, text: string) {
  for (let p = 0; p < pageCount; p++) {
    c.ops.push({
      kind: "text",
      page: p,
      x: MARGIN,
      y: MARGIN - 12,
      text: `${text} · página ${p + 1} de ${pageCount}`,
      size: 7,
      bold: false,
      color: "muted",
    });
  }
}

/* formatting */

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  google_business: "Google Business",
};

/** pt-BR thousands separator. `Intl` is avoided: server locale is not guaranteed. */
export function fmtNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${fmtDate(iso)} às ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
