/**
 * VELT — Weekly report PDF renderer.
 *
 * This module does exactly one thing: execute the layout operations with
 * pdf-lib. Pagination, wrapping and content decisions live in `layout.ts`, where
 * they are testable without producing bytes.
 *
 * `pdf-lib` notes:
 *  - Standard fonts (Helvetica/Helvetica-Bold) encode all of pt-BR in WinAnsi,
 *    verified against `·`, `—`, `ç`, `ã`, `õ`. Embedding a font would add ~200 kB
 *    per report for no visible gain.
 *  - No external images: the report must render on a server with no network and
 *    no storage bucket.
 *  - Metadata dates are pinned to `generatedAt`, so the same payload always
 *    yields the same bytes and the file hash means something.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { WeeklyReportData } from "./weekly";
import {
  layoutWeeklyReport,
  measureApprox,
  PAGE_H,
  PAGE_W,
  fmtDateTime,
  type ColorName,
  type DrawOp,
} from "./layout";

const COLORS: Record<ColorName, ReturnType<typeof rgb>> = {
  ink: rgb(0.08, 0.09, 0.12),
  muted: rgb(0.42, 0.45, 0.5),
  rule: rgb(0.97, 0.97, 0.98),
  brand: rgb(0.36, 0.18, 0.86),
  positive: rgb(0.05, 0.55, 0.35),
  negative: rgb(0.78, 0.2, 0.2),
};

export async function renderWeeklyReportPdf(
  data: WeeklyReportData,
  meta: { workspaceName: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Real font metrics feed the layout, so line breaks on paper match the model.
  const measure = (text: string, size: number) => {
    try {
      return regular.widthOfTextAtSize(text, size);
    } catch {
      // Characters outside WinAnsi would throw here; falling back keeps the
      // report rendering instead of failing the whole job over one glyph.
      return measureApprox(text, size);
    }
  };

  const layout = layoutWeeklyReport(data, meta, measure, {
    footerText: `Gerado pelo VELT em ${fmtDateTime(data.generatedAt)}`,
  });

  const pages = Array.from({ length: layout.pageCount }, () => doc.addPage([PAGE_W, PAGE_H]));

  doc.setTitle(`Relatório semanal — ${meta.workspaceName}`);
  doc.setSubject("Desempenho semanal de conteúdo");
  doc.setProducer("VELT");
  doc.setCreator("VELT — relatório semanal");
  doc.setCreationDate(new Date(data.generatedAt));
  doc.setModificationDate(new Date(data.generatedAt));

  for (const op of layout.ops) {
    drawOp(op, pages[op.page], regular, bold);
  }

  // `useObjectStreams: false` trades a few kB for structure that external tools
  // (and users' PDF readers) can inspect without full decompression.
  return doc.save({ useObjectStreams: false });
}

function drawOp(
  op: DrawOp,
  page: ReturnType<PDFDocument["addPage"]> | undefined,
  regular: PDFFont,
  bold: PDFFont,
) {
  if (!page) return;

  switch (op.kind) {
    case "text": {
      // A single unsupported codepoint must not abort the whole report; replace
      // it rather than throwing mid-document.
      const safe = sanitize(op.text);
      page.drawText(safe, {
        x: op.x,
        y: op.y,
        size: op.size,
        font: op.bold ? bold : regular,
        color: COLORS[op.color],
      });
      break;
    }
    case "rect":
      page.drawRectangle({
        x: op.x,
        y: op.y,
        width: op.width,
        height: op.height,
        ...(op.fill ? { color: COLORS[op.fill] } : {}),
        ...(op.stroke ? { borderColor: COLORS[op.stroke], borderWidth: 0.7 } : {}),
      });
      break;
    case "line":
      page.drawLine({
        start: { x: op.x1, y: op.y1 },
        end: { x: op.x2, y: op.y2 },
        thickness: 0.7,
        color: COLORS.muted,
        opacity: 0.35,
      });
      break;
    case "circle":
      page.drawCircle({ x: op.x, y: op.y, size: op.radius, color: COLORS[op.color] });
      break;
  }
}

/**
 * WinAnsi is Latin-1 plus a handful of typographic characters in the 0x80–0x9F
 * block — which includes the em dash (—) and the middle dot (·), both used in
 * this report. The first version stripped everything above U+00FF and turned
 * "21/10 — 28/10" into "21/10 ? 28/10".
 *
 * Emoji and CJK still cannot be encoded, and pdf-lib throws rather than
 * substituting, so they are the only thing replaced here.
 */
const WINANSI_EXTRA = new Set([
  "\u20AC",
  "\u201A",
  "\u0192",
  "\u201E",
  "\u2026",
  "\u2020",
  "\u2021",
  "\u02C6",
  "\u2030",
  "\u0160",
  "\u2039",
  "\u0152",
  "\u017D",
  "\u2018",
  "\u2019",
  "\u201C",
  "\u201D",
  "\u2022",
  "\u2013",
  "\u2014",
  "\u02DC",
  "\u2122",
  "\u0161",
  "\u203A",
  "\u0153",
  "\u017E",
  "\u0178",
]);

function sanitize(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp <= 0xff || WINANSI_EXTRA.has(ch)) out += ch;
    else out += "?";
  }
  return out;
}
