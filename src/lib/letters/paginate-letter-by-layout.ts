/**
 * Pure layout pagination: assigns body block indices to pages using measured heights.
 */

const EPS = 2;
/**
 * Extra px beyond measured footer box (QR load, print variance, flex rounding).
 * Underestimating causes single-page layout while PDF clips the atomic footer at 297mm.
 */
export const DEFAULT_FOOTER_RESERVE_PX = 120;

/**
 * Require this much free space inside the content column before accepting “everything on one page”.
 * Compensates for subpixel/layout differences between measure and print.
 */
export const SINGLE_PAGE_INNER_SLACK_PX = 40;

/** Slack when fitting remaining body above atomic footer on last sheet. */
const LAST_PAGE_BODY_SLACK_PX = 28;

/** footer budget uses max(DEFAULT, ratio of measured footer + floor). */
export const effectiveFooterReservePx = (footerPx: number, baseReserve: number): number =>
  Math.max(baseReserve, Math.round(footerPx * 0.22) + 48);

/** 96 CSS px per inch / 25.4 mm per inch — matches browser layout for padding math. */
export const MM_TO_PX = 96 / 25.4;

export type LetterLayoutDims = {
  innerHeightPx: number;
  /**
   * Optional taller inner column for page 1 when top padding is smaller than other pages (mm).
   * If omitted, uses innerHeightPx.
   */
  innerHeightFirstPagePx?: number;
  headerStudentPx: number;
  continuedLabelPx: number;
  footerPx: number;
  /** Extra vertical slack subtracted with footer when computing last-page body budget. */
  footerReservePx?: number;
};

/**
 * Paginate body blocks by height.
 * Single-page: header + student + body + footer fit on one sheet.
 * Multi-page: page 1 = header + student + body (no footer); middle = continued + body;
 * last = continued + body tail + footer. If all body fits on page 1 but footer must move down,
 * adds a final page with empty body + footer only.
 */
export const paginateBlockIndicesByHeight = (heights: number[], dim: LetterLayoutDims): number[][] => {
  const {
    innerHeightPx,
    innerHeightFirstPagePx,
    headerStudentPx,
    continuedLabelPx,
    footerPx,
    footerReservePx = DEFAULT_FOOTER_RESERVE_PX,
  } = dim;
  const n = heights.length;

  if (n === 0) return [[]];

  const totalBody = heights.reduce((a, h) => a + h, 0);

  const firstInner = innerHeightFirstPagePx ?? innerHeightPx;
  const firstPageBodyMulti = Math.max(0, firstInner - headerStudentPx);
  const middleBody = Math.max(0, innerHeightPx - continuedLabelPx);
  const footerTotal = footerPx + footerReservePx;
  const lastBody = Math.max(0, innerHeightPx - continuedLabelPx - footerTotal);
  /** Stricter than EPS: must leave slack or print clips footer at sheet bottom. */
  const singlePageMax = innerHeightPx - SINGLE_PAGE_INNER_SLACK_PX;

  /** Entire letter on one physical page. */
  if (headerStudentPx + totalBody + footerTotal <= singlePageMax) {
    return [Array.from({ length: n }, (_, i) => i)];
  }

  const pages: number[][] = [];
  let i = 0;

  /** Page 1: header + student + body (footer reserved for last sheet only). */
  const p0: number[] = [];
  let h0 = 0;
  while (i < n && h0 + heights[i] <= firstPageBodyMulti + EPS) {
    p0.push(i);
    h0 += heights[i];
    i += 1;
  }
  if (p0.length === 0 && i < n) {
    p0.push(i);
    h0 += heights[i];
    i += 1;
  }
  pages.push(p0);

  /** All body on page 1; footer does not fit on same sheet → last page = full footer block only. */
  if (i >= n) {
    if (headerStudentPx + totalBody + footerTotal > singlePageMax) {
      pages.push([]);
    }
    return pages;
  }

  /** Middle + last pages. */
  while (i < n) {
    const restHeights = heights.slice(i);
    const sumRest = restHeights.reduce((a, h) => a + h, 0);
    if (sumRest <= lastBody - LAST_PAGE_BODY_SLACK_PX + EPS) {
      pages.push(Array.from({ length: restHeights.length }, (_, k) => i + k));
      break;
    }

    const pm: number[] = [];
    let hm = 0;
    while (i < n && hm + heights[i] <= middleBody + EPS) {
      pm.push(i);
      hm += heights[i];
      i += 1;
    }
    if (pm.length === 0) {
      pm.push(i);
      i += 1;
    }
    pages.push(pm);
  }

  return pages;
};
