import { EXECUTIVE_MARGINS } from "@/lib/pdf/tokens/executive-spacing";

export type ExecutivePdfOrientation = "portrait" | "landscape";

export const EXECUTIVE_PAGE = {
  portrait: { widthMm: 210, heightMm: 297 },
  landscape: { widthMm: 297, heightMm: 210 },
} as const;

export const EXECUTIVE_PAGE_SIZE = "A4" as const;

/** @deprecated use EXECUTIVE_PAGE */
export const EXECUTIVE_PDF_PAGE = EXECUTIVE_PAGE;

export const executivePrintableWidthMm = (orientation: ExecutivePdfOrientation): number => {
  const page = EXECUTIVE_PAGE[orientation];
  return page.widthMm - EXECUTIVE_MARGINS.sideMm * 2;
};

export const executivePrintableHeightMm = (orientation: ExecutivePdfOrientation): number => {
  const page = EXECUTIVE_PAGE[orientation];
  return page.heightMm - EXECUTIVE_MARGINS.topMm - EXECUTIVE_MARGINS.bottomMm;
};

/** @deprecated */
export const executivePdfPrintableWidthMm = executivePrintableWidthMm;

/** @deprecated */
export const executivePdfPrintableHeightMm = executivePrintableHeightMm;

export const executivePageRule = (orientation: ExecutivePdfOrientation): string => {
  const m = EXECUTIVE_MARGINS;
  return `@page {
  size: A4 ${orientation};
  margin: ${m.topMm}mm ${m.sideMm}mm ${m.bottomMm + 8}mm ${m.sideMm}mm;
}`;
};

/** @deprecated */
export const executivePdfPageRule = executivePageRule;
