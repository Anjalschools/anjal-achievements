/** Executive PDF spacing & page margin tokens (mm). */
export const EXECUTIVE_MARGINS = {
  topMm: 14,
  bottomMm: 14,
  sideMm: 10,
} as const;

export const EXECUTIVE_SPACING = {
  sectionGapMm: 6,
  headerBottomMm: 5,
  tableTopMm: 4,
  footerTopMm: 4,
  pageInnerPadMm: 2,
} as const;

/** @deprecated use EXECUTIVE_MARGINS */
export const EXECUTIVE_PDF_MARGINS = EXECUTIVE_MARGINS;

/** @deprecated use EXECUTIVE_SPACING */
export const EXECUTIVE_PDF_SPACING = EXECUTIVE_SPACING;
