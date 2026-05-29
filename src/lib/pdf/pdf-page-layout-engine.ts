/**
 * Single source of truth for executive / analytics PDF page geometry.
 * All report types must derive margins and content bands from here.
 */

import {
  PDF_OFFICIAL_BANNER_HEIGHT_MM,
  PDF_OFFICIAL_META_BAND_COMPACT_MM,
  PDF_OFFICIAL_META_BAND_FULL_MM,
  pdfOfficialHeaderTotalMm,
} from "@/lib/pdf/report-header-standard";
import { EXECUTIVE_MARGINS } from "@/lib/pdf/tokens/executive-spacing";
import { EXECUTIVE_PAGE, type ExecutivePdfOrientation } from "@/lib/pdf/tokens/executive-print";

/** Full official header (banner + title/meta) — mm. */
export const PDF_STANDARD_HEADER_HEIGHT_MM = pdfOfficialHeaderTotalMm(false);

/** Continuation pages — same banner, compact meta. */
export const PDF_STANDARD_HEADER_COMPACT_MM = pdfOfficialHeaderTotalMm(true);

export { PDF_OFFICIAL_BANNER_HEIGHT_MM, PDF_OFFICIAL_META_BAND_FULL_MM, PDF_OFFICIAL_META_BAND_COMPACT_MM };

/** Reserved footer band inside the printable area (mm). */
export const PDF_STANDARD_FOOTER_HEIGHT_MM = 12;

/** Continuation pages — banner only (mm). */
export const PDF_STANDARD_CONTINUATION_HEADER_MM = PDF_OFFICIAL_BANNER_HEIGHT_MM + 3;

export type PdfPageLayout = {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  headerHeight: number;
  footerHeight: number;
  /** Distance from physical page top to start of main content (mm). */
  contentStartY: number;
  /** Distance from physical page top where main content should end (mm). */
  contentEndY: number;
  printableWidth: number;
  printableHeight: number;
  /** Content area below official header band (mm). */
  usableContentHeight: number;
  headerHeightFull: number;
  headerHeightCompact: number;
};

export const getPdfPageLayout = (
  orientation: ExecutivePdfOrientation = "landscape",
  opts?: { compactHeader?: boolean }
): PdfPageLayout => {
  const page = EXECUTIVE_PAGE[orientation];
  const marginTop = EXECUTIVE_MARGINS.topMm;
  const marginBottom = EXECUTIVE_MARGINS.bottomMm;
  const marginLeft = EXECUTIVE_MARGINS.sideMm;
  const marginRight = EXECUTIVE_MARGINS.sideMm;
  const headerHeightFull = PDF_STANDARD_HEADER_HEIGHT_MM;
  const headerHeightCompact = PDF_STANDARD_HEADER_COMPACT_MM;
  const headerHeight = opts?.compactHeader ? headerHeightCompact : headerHeightFull;
  const footerHeight = PDF_STANDARD_FOOTER_HEIGHT_MM;
  const printableWidth = page.widthMm - marginLeft - marginRight;
  const printableHeight = page.heightMm - marginTop - marginBottom;
  const contentStartY = marginTop + headerHeight;
  const contentEndY = page.heightMm - marginBottom - footerHeight;
  const usableContentHeight = Math.max(40, contentEndY - contentStartY);

  return {
    pageWidth: page.widthMm,
    pageHeight: page.heightMm,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    headerHeight,
    footerHeight,
    contentStartY,
    contentEndY,
    printableWidth,
    printableHeight,
    usableContentHeight,
    headerHeightFull,
    headerHeightCompact,
  };
};

/** @deprecated use getPdfPageLayout — competition tables */
export const competitionPdfPageFromLayout = (orientation: ExecutivePdfOrientation) => {
  const layout = getPdfPageLayout(orientation);
  return {
    widthMm: layout.pageWidth,
    heightMm: layout.pageHeight,
    margins: {
      topMm: layout.marginTop,
      bottomMm: layout.marginBottom,
      sideMm: layout.marginLeft,
    },
    usableWidthMm: layout.printableWidth,
    printableHeightMm: layout.printableHeight,
  };
};
