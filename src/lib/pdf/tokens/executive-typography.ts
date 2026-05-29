/** Executive PDF typography tokens. */
export const EXECUTIVE_TYPOGRAPHY = {
  fontFamilyAr: '"Cairo", "Tajawal", Tahoma, "Segoe UI", Arial, sans-serif',
  fontFamilyEn: 'Tahoma, "Inter", "Segoe UI", Arial, sans-serif',
  fontFallbackPrint: 'Tahoma, "Segoe UI", Arial, sans-serif',
  h1: "28px",
  h1Weight: "700",
  h2: "20px",
  h2Weight: "600",
  section: "13px",
  meta: "12px",
  body: "11px",
  table: "11px",
  tableCompact: "10px",
  footer: "9px",
  lineHeight: "1.45",
  tableLineHeight: "1.35",
} as const;

/** @deprecated use EXECUTIVE_TYPOGRAPHY */
export const EXECUTIVE_PDF_TYPOGRAPHY = EXECUTIVE_TYPOGRAPHY;
