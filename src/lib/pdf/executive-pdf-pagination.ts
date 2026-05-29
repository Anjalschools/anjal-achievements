import {
  executivePdfPrintableHeightMm,
  type ExecutivePdfOrientation,
} from "@/lib/pdf/executive-pdf-theme";
import {
  PDF_STANDARD_CONTINUATION_HEADER_MM,
  PDF_STANDARD_HEADER_HEIGHT_MM,
} from "@/lib/pdf/pdf-page-layout-engine";

export const EXECUTIVE_PDF_ROW_HEIGHT_MM = 7.2;
export const EXECUTIVE_PDF_TABLE_HEADER_MM = 14;
/** Full first-page official header band (banner + title/meta). */
export const EXECUTIVE_PDF_PAGE_HEADER_MM = PDF_STANDARD_HEADER_HEIGHT_MM;
/** Continuation pages — banner only. */
export const EXECUTIVE_PDF_PAGE_CONTINUATION_HEADER_MM = PDF_STANDARD_CONTINUATION_HEADER_MM;
export const EXECUTIVE_PDF_PAGE_FOOTER_MM = 16;
export const EXECUTIVE_PDF_KPI_BAND_MM = 24;
export const EXECUTIVE_PDF_VERTICAL_CENTER_SLACK_MM = 24;

export const estimateTableBlockHeightMm = (rowCount: number, includeHeader = true): number =>
  (includeHeader ? EXECUTIVE_PDF_TABLE_HEADER_MM : 0) + rowCount * EXECUTIVE_PDF_ROW_HEIGHT_MM;

export type ExecutivePdfPageCompositionInput = {
  orientation: ExecutivePdfOrientation;
  role: "cover" | "continuation";
  rowCount: number;
  tableHeightMm: number;
  includeHeader: boolean;
  includeKpi: boolean;
};

export type ExecutivePdfPageCompositionPlan = {
  printableHeightMm: number;
  printableWidthMm: number;
  pageClass: string;
  innerStyle: string;
  tableStageStyle: string;
  slackMm: number;
};

export const composeExecutivePdfPage = (
  input: ExecutivePdfPageCompositionInput,
  printableWidthMm: number
): ExecutivePdfPageCompositionPlan => {
  const printableHeightMm = executivePdfPrintableHeightMm(input.orientation);

  let contentMm = input.tableHeightMm + EXECUTIVE_PDF_PAGE_FOOTER_MM;
  if (input.includeHeader) contentMm += EXECUTIVE_PDF_PAGE_HEADER_MM;
  if (input.includeKpi) contentMm += EXECUTIVE_PDF_KPI_BAND_MM;
  contentMm += 8;

  const slackMm = printableHeightMm - contentMm;
  const isSparse = slackMm >= EXECUTIVE_PDF_VERTICAL_CENTER_SLACK_MM;
  const isContinuation = input.role === "continuation";

  const pageClasses = ["page-shell"];
  if (isContinuation) pageClasses.push("page-shell--continuation");
  if (isSparse) pageClasses.push("page-shell--balanced");

  const topInset =
    !isSparse && !isContinuation ? 2
    : isSparse ? Math.min(Math.round(slackMm * 0.32), 16)
    : 2;

  const innerStyle = `min-height:${printableHeightMm}mm;padding-top:${topInset}mm`;
  const tableStageStyle = isSparse
    ? "flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center"
    : "flex:1;display:flex;flex-direction:column;justify-content:flex-start;align-items:center";

  return {
    printableHeightMm,
    printableWidthMm,
    pageClass: pageClasses.join(" "),
    innerStyle,
    tableStageStyle,
    slackMm,
  };
};

/** Split rows into chunks that fit printable height (smart table pagination). */
export const chunkRowsByPrintableHeight = <T>(opts: {
  rows: T[];
  orientation: ExecutivePdfOrientation;
  firstPageOverheadMm: number;
  continuationOverheadMm: number;
  minRowsPerChunk?: number;
}): T[][] => {
  const printable = executivePdfPrintableHeightMm(opts.orientation);
  const minRows = opts.minRowsPerChunk ?? 3;
  const chunks: T[][] = [];
  let i = 0;
  let chunkIndex = 0;

  while (i < opts.rows.length) {
    const overhead =
      chunkIndex === 0 ? opts.firstPageOverheadMm : opts.continuationOverheadMm;
    const available = printable - overhead - EXECUTIVE_PDF_PAGE_FOOTER_MM;
    const maxRows = Math.max(
      minRows,
      Math.floor((available - EXECUTIVE_PDF_TABLE_HEADER_MM) / EXECUTIVE_PDF_ROW_HEIGHT_MM)
    );
    chunks.push(opts.rows.slice(i, i + maxRows));
    i += maxRows;
    chunkIndex += 1;
  }

  const balanced = balanceRowChunks(chunks, minRows);
  return balanced.length > 0 ? balanced : [[]];
};

const ORPHAN_LAST_CHUNK_RATIO = 0.28;
const MIN_ROWS_TO_BORROW = 2;

/**
 * Redistribute rows so the last page is not nearly empty (avoids giant whitespace).
 */
export const balanceRowChunks = <T>(chunks: T[][], minRowsPerChunk = 3): T[][] => {
  if (chunks.length < 2) return chunks;

  const out = chunks.map((c) => [...c]);
  let last = out[out.length - 1]!;
  const prev = out[out.length - 2]!;

  if (
    last.length > 0 &&
    prev.length > minRowsPerChunk + MIN_ROWS_TO_BORROW &&
    last.length < Math.max(minRowsPerChunk, Math.floor(prev.length * ORPHAN_LAST_CHUNK_RATIO))
  ) {
    const deficit = Math.ceil(prev.length * 0.35) - last.length;
    const move = Math.min(Math.max(MIN_ROWS_TO_BORROW, deficit), prev.length - minRowsPerChunk);
    if (move > 0) {
      const borrowed = prev.splice(prev.length - move, move);
      last = [...borrowed, ...last];
      out[out.length - 1] = last;
    }
  }

  if (out.length >= 2) {
    const tail = out[out.length - 1]!;
    const before = out[out.length - 2]!;
    if (tail.length === 1 && before.length > minRowsPerChunk + 1) {
      const moved = before.pop();
      if (moved !== undefined) tail.unshift(moved);
    }
  }

  return out.filter((c) => c.length > 0);
};

export type ExecutivePdfChunkPageInput = {
  chunkHtml: string;
  pageIndex: number;
  pageTotal: number;
  isAr: boolean;
  continuationLabel?: string;
  /** Official `report-header.png` banner — required on every page. */
  continuationHeaderHtml?: string;
  footerHtml?: string;
};

export const wrapExecutivePdfChunkPage = (input: ExecutivePdfChunkPageInput): string => {
  const cont =
    input.pageTotal > 1 && input.pageIndex > 0
      ? `<p class="ep-continuation">${input.continuationLabel ?? (input.isAr ? `تابع — صفحة ${input.pageIndex + 1} من ${input.pageTotal}` : `Continued — page ${input.pageIndex + 1} of ${input.pageTotal}`)}</p>`
      : "";
  const headerBlock = input.continuationHeaderHtml ?? "";
  const footerBlock = input.footerHtml ?? "";
  return `<div class="page-shell page-content${input.pageIndex > 0 ? " page-shell--continuation" : ""}">
${headerBlock}
${cont}
<div class="ep-table-wrap">${input.chunkHtml}</div>
${footerBlock}
</div>`;
};
