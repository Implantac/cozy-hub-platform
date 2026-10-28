import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { buildReportData, type PublishedPost } from "@/lib/reports/weekly";
import { renderWeeklyReportPdf } from "@/lib/reports/render";
import {
  fmtNumber,
  layoutWeeklyReport,
  measureApprox,
  PAGE_H,
  MARGIN,
  type DrawOp,
} from "@/lib/reports/layout";

/**
 * Two layers, tested separately:
 *
 *  - **Layout** (pure): pagination, wrapping and content, asserted on the ops
 *    array. This is where the real bugs live — text drawn past the bottom margin
 *    disappears without any error.
 *  - **Render**: that pdf-lib produces a document a reader can open.
 *
 * The first version tested only the PDF bytes. It passed while a long title was
 * silently running off the page.
 */

const NOW = "2026-10-28T12:00:00.000Z";
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.parse(NOW) - daysAgo * DAY).toISOString();

function sample(over: Partial<Parameters<typeof buildReportData>[0]> = {}) {
  return buildReportData({
    workspaceName: "Padaria Vila Nova",
    window: { start: iso(7), end: iso(0) },
    previousWindow: { start: iso(14), end: iso(7) },
    published: [
      {
        contentId: "a",
        title: "Pão de fermentação natural",
        platform: "instagram",
        publishedAt: iso(2),
      },
      { contentId: "b", title: "Promoção de inverno", platform: "facebook", publishedAt: iso(4) },
    ] as PublishedPost[],
    metricsCurrent: [
      { contentId: "a", metrics: { impressions: 1200, engagement: 143, saves: 21 } },
      { contentId: "b", metrics: { impressions: 800, engagement: 64, saves: 9 } },
    ],
    metricsPrevious: [
      { contentId: "z", metrics: { impressions: 1000, engagement: 100, saves: 10 } },
    ],
    now: NOW,
    ...over,
  });
}

/** Decompresses the PDF content streams so text assertions can run on them. */
function decompressAll(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  const out: Buffer[] = [];
  let idx = buf.indexOf("stream\n");
  while (idx !== -1) {
    const start = idx + 7;
    const end = buf.indexOf("endstream", start);
    if (end === -1) break;
    try {
      out.push(inflateSync(buf.subarray(start, end)));
    } catch {
      /* not a Flate stream */
    }
    idx = buf.indexOf("stream\n", end);
  }
  return Buffer.concat(out).toString("latin1");
}

const texts = (ops: DrawOp[]) =>
  ops.filter((o): o is Extract<DrawOp, { kind: "text" }> => o.kind === "text");

describe("layoutWeeklyReport", () => {
  it("puts the computed totals on the page", () => {
    const { ops } = layoutWeeklyReport(sample(), { workspaceName: "X" }, measureApprox);
    const all = texts(ops)
      .map((o) => o.text)
      .join(" | ");
    expect(all).toContain("2.000"); // 1200 + 800 impressions
    expect(all).toContain("207"); // 143 + 64 engagement
    expect(all).toContain("X");
  });

  it("never draws below the bottom margin", () => {
    const big = sample({
      published: Array.from({ length: 30 }, (_, i) => ({
        contentId: `p${i}`,
        title: `Post ${i} `.repeat(30),
        platform: "instagram",
        publishedAt: iso(1),
      })) as PublishedPost[],
      metricsCurrent: Array.from({ length: 30 }, (_, i) => ({
        contentId: `p${i}`,
        metrics: { engagement: 100 - i, impressions: 1000 },
      })),
    });
    const { ops } = layoutWeeklyReport(big, { workspaceName: "X" }, measureApprox);
    // The invariant the first implementation broke.
    const below = texts(ops).filter((o) => o.y < MARGIN - 20);
    expect(below).toEqual([]);
  });

  it("paginates instead of dropping overflowing text", () => {
    const long = sample({
      published: [
        {
          contentId: "a",
          title: "Pão de fermentação natural ".repeat(400),
          platform: "instagram",
          publishedAt: iso(1),
        },
      ] as PublishedPost[],
      metricsCurrent: [{ contentId: "a", metrics: { engagement: 10, impressions: 100 } }],
    });
    const { pageCount, ops } = layoutWeeklyReport(long, { workspaceName: "X" }, measureApprox);
    expect(pageCount).toBeGreaterThan(1);
    // Every page that exists has content on it.
    for (let p = 0; p < pageCount; p++) {
      expect(ops.some((o) => o.page === p)).toBe(true);
    }
  });

  it("numbers every page with the page count", () => {
    const long = sample({
      published: [
        {
          contentId: "a",
          title: "Pão de fermentação natural ".repeat(400),
          platform: "instagram",
          publishedAt: iso(1),
        },
      ] as PublishedPost[],
      metricsCurrent: [{ contentId: "a", metrics: { engagement: 10, impressions: 100 } }],
    });
    const { pageCount, ops } = layoutWeeklyReport(long, { workspaceName: "X" }, measureApprox, {
      footerText: "Gerado pelo VELT",
    });
    const footers = texts(ops).filter((o) => o.text.includes("página"));
    expect(footers).toHaveLength(pageCount);
    expect(footers[0].text).toContain(`página 1 de ${pageCount}`);
  });

  it("keeps a busy week readable: three top posts, not forty", () => {
    const many = sample({
      published: Array.from({ length: 40 }, (_, i) => ({
        contentId: `p${i}`,
        title: `Post número ${i}`,
        platform: i % 2 ? "instagram" : "facebook",
        publishedAt: iso(1),
      })) as PublishedPost[],
      metricsCurrent: Array.from({ length: 40 }, (_, i) => ({
        contentId: `p${i}`,
        metrics: { engagement: 100 - i, impressions: 1000 },
      })),
    });
    expect(many.topPosts).toHaveLength(3);
    const { pageCount } = layoutWeeklyReport(many, { workspaceName: "X" }, measureApprox);
    expect(pageCount).toBe(1);
  });

  it("renders an empty week without inventing content", () => {
    const empty = sample({ published: [], metricsCurrent: [], metricsPrevious: [] });
    const { ops, pageCount } = layoutWeeklyReport(empty, { workspaceName: "X" }, measureApprox);
    expect(pageCount).toBe(1);
    const all = texts(ops)
      .map((o) => o.text)
      .join(" ");
    expect(all).toContain("Nenhuma publicação nesta semana");
  });
});

describe("fmtNumber", () => {
  it("uses pt-BR thousands separators", () => {
    expect(fmtNumber(999)).toBe("999");
    expect(fmtNumber(1000)).toBe("1.000");
    expect(fmtNumber(1234567)).toBe("1.234.567");
  });

  it("never emits NaN on a report", () => {
    expect(fmtNumber(NaN)).toBe("0");
    expect(fmtNumber(Infinity)).toBe("0");
  });
});

describe("renderWeeklyReportPdf", () => {
  it("produces a valid, openable PDF with metadata", async () => {
    const bytes = await renderWeeklyReportPdf(sample(), { workspaceName: "Padaria Vila Nova" });
    expect(bytes.byteLength).toBeGreaterThan(1000);

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toContain("Padaria Vila Nova");
    expect(doc.getCreator()).toContain("VELT");
  });

  it("is byte-identical for identical input", async () => {
    const meta = { workspaceName: "Padaria Vila Nova" };
    const a = await renderWeeklyReportPdf(sample(), meta);
    const b = await renderWeeklyReportPdf(sample(), meta);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it("keeps the em dash and middle dot that WinAnsi does support", async () => {
    // The first sanitiser stripped everything above U+00FF and turned the date
    // range "21/10 — 28/10" into "21/10 ? 28/10" in every report.
    //
    // pdf-lib writes WinAnsi single-byte hex strings: the em dash is 0x97 and
    // the middle dot 0xB7, not their Unicode hex values.
    const bytes = await renderWeeklyReportPdf(sample(), { workspaceName: "X" });
    const raw = decompressAll(bytes);
    const hexStrings = [...raw.matchAll(/<([0-9A-Fa-f]+)> Tj/g)].map((m) => m[1].toLowerCase());

    const decoded = hexStrings.map((h) => {
      try {
        return Buffer.from(h, "hex").toString("latin1");
      } catch {
        return "";
      }
    });

    expect(decoded.some((t) => t.includes("\u0097"))).toBe(true); // em dash
    expect(decoded.some((t) => t.includes("\u00b7"))).toBe(true); // middle dot
    // And nothing was replaced by "?" on a report whose text is all encodable.
    expect(decoded.join("")).not.toContain("?");
  });

  it("survives emoji in a post title, which WinAnsi cannot encode", async () => {
    // pdf-lib throws on unencodable glyphs rather than substituting; a client's
    // report must not fail because they used 🔥 in a caption.
    const data = sample({
      published: [
        {
          contentId: "a",
          title: "Promoção 🔥 imperdível 我們",
          platform: "instagram",
          publishedAt: iso(1),
        },
      ] as PublishedPost[],
      metricsCurrent: [{ contentId: "a", metrics: { engagement: 5, impressions: 100 } }],
    });
    await expect(renderWeeklyReportPdf(data, { workspaceName: "X" })).resolves.toBeDefined();
  });

  it("produces the number of pages the layout promised", async () => {
    const long = sample({
      published: [
        {
          contentId: "a",
          title: "Pão de fermentação natural ".repeat(400),
          platform: "instagram",
          publishedAt: iso(1),
        },
      ] as PublishedPost[],
      metricsCurrent: [{ contentId: "a", metrics: { engagement: 10, impressions: 100 } }],
    });
    const { pageCount } = layoutWeeklyReport(long, { workspaceName: "X" }, measureApprox);
    const bytes = await renderWeeklyReportPdf(long, { workspaceName: "X" });
    const doc = await PDFDocument.load(bytes);
    // Layout and render must agree; a drift here means blank pages or lost text.
    expect(doc.getPageCount()).toBe(pageCount);
    expect(PAGE_H).toBeGreaterThan(0);
  });
});
