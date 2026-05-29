/**
 * Unified executive PDF stylesheet — consumes tokens from src/lib/pdf/tokens/.
 */

import {
  EXECUTIVE_COLORS,
  EXECUTIVE_PDF_PALETTE,
} from "@/lib/pdf/tokens/executive-colors";
import {
  EXECUTIVE_MARGINS,
  EXECUTIVE_PDF_MARGINS,
  EXECUTIVE_PDF_SPACING,
  EXECUTIVE_SPACING,
} from "@/lib/pdf/tokens/executive-spacing";
import {
  EXECUTIVE_PDF_TYPOGRAPHY,
  EXECUTIVE_TYPOGRAPHY,
} from "@/lib/pdf/tokens/executive-typography";
import {
  PDF_OFFICIAL_BANNER_HEIGHT_MM,
} from "@/lib/pdf/report-header-standard";
import {
  executivePageRule,
  executivePdfPageRule,
  executivePdfPrintableHeightMm,
  executivePdfPrintableWidthMm,
  EXECUTIVE_PAGE,
  EXECUTIVE_PDF_PAGE,
  type ExecutivePdfOrientation,
} from "@/lib/pdf/tokens/executive-print";

export type { ExecutivePdfOrientation };
export {
  EXECUTIVE_COLORS,
  EXECUTIVE_PDF_PALETTE,
  EXECUTIVE_MARGINS,
  EXECUTIVE_PDF_MARGINS,
  EXECUTIVE_SPACING,
  EXECUTIVE_PDF_SPACING,
  EXECUTIVE_TYPOGRAPHY,
  EXECUTIVE_PDF_TYPOGRAPHY,
  EXECUTIVE_PAGE,
  EXECUTIVE_PDF_PAGE,
  executivePdfPrintableWidthMm,
  executivePdfPrintableHeightMm,
  executivePdfPageRule,
  executivePageRule,
};

export const executivePdfPageCounterRule = (): string => `@page {
  @bottom-center {
    content: counter(page) " / " counter(pages);
    font-family: ${EXECUTIVE_PDF_TYPOGRAPHY.fontFamilyAr};
    font-size: 8pt;
    color: ${EXECUTIVE_PDF_PALETTE.subdued};
    font-variant-numeric: tabular-nums;
  }
}`;

/** Base reset + typography + page shell utilities */
export const executivePdfBaseStyles = (isAr: boolean): string => {
  const p = EXECUTIVE_PDF_PALETTE;
  const t = EXECUTIVE_PDF_TYPOGRAPHY;
  const font = isAr ? t.fontFamilyAr : t.fontFamilyEn;

  return `
${executivePdfPageRule("landscape")}
${executivePdfPageRule("portrait")}
${executivePdfPageCounterRule()}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  color: ${p.text};
  font-family: ${font};
  font-size: ${t.body};
  line-height: ${t.lineHeight};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
body { background: #fff; }

.page-shell {
  position: relative;
  min-height: 100%;
  padding: 0 ${EXECUTIVE_PDF_SPACING.pageInnerPadMm}mm;
  break-after: page;
  page-break-after: always;
}
.page-shell:last-child {
  break-after: auto;
  page-break-after: auto;
}
.page-content {
  position: relative;
  z-index: 1;
}
.page-section {
  margin-bottom: ${EXECUTIVE_PDF_SPACING.sectionGapMm}mm;
  break-inside: avoid;
  page-break-inside: avoid;
}
.page-section--flow {
  break-inside: auto;
  page-break-inside: auto;
}

.ep-h1 {
  margin: 0 0 8px;
  font-size: ${t.h1};
  font-weight: ${t.h1Weight};
  line-height: 1.2;
  text-align: center;
  color: ${p.primaryNavy};
}
.ep-h2 {
  margin: 0 0 6px;
  font-size: ${t.h2};
  font-weight: ${t.h2Weight};
  color: ${p.executiveBlue};
  break-after: avoid;
}
.ep-meta {
  margin: 0 0 10px;
  font-size: ${t.meta};
  color: ${p.muted};
  text-align: center;
}
.ep-subtitle {
  margin: 0 0 6px;
  font-size: ${t.meta};
  color: ${p.muted};
  text-align: center;
  font-weight: 600;
}
.ep-kicker {
  margin: 0 0 6px;
  font-size: ${t.footer};
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: ${p.muted};
  text-align: center;
}
.ep-note {
  margin: 0 0 4mm;
  padding: 3mm 4mm;
  border: 1px solid ${p.noteBorder};
  background: ${p.noteBg};
  border-radius: 4px;
  font-size: ${t.footer};
  color: ${p.noteText};
  break-inside: avoid;
}
.ep-wm {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56px;
  font-weight: 900;
  color: ${p.subdued};
  opacity: 0.06;
  transform: rotate(-28deg);
  pointer-events: none;
  z-index: 0;
}
.ep-num { font-variant-numeric: tabular-nums; white-space: nowrap; }

.ep-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 8px 0 12px;
  break-inside: avoid;
}
.ep-kpi {
  border: 1px solid ${p.border};
  border-radius: 8px;
  padding: 8px 10px;
  background: ${p.lightBg};
  break-inside: avoid;
}
.ep-kpi-label {
  font-size: ${t.footer};
  color: ${p.muted};
  font-weight: 700;
}
.ep-kpi-value {
  font-size: 15px;
  font-weight: 800;
  margin-top: 4px;
  color: ${p.primaryNavy};
}

.ep-meta-block {
  margin: 8px 0 10px;
  break-inside: avoid;
  border: 1px solid ${p.border};
  border-radius: 8px;
  padding: 8px;
  background: #fff;
}
table.ep-meta-grid {
  width: 100%;
  font-size: ${t.footer};
  border-collapse: collapse;
}
table.ep-meta-grid th,
table.ep-meta-grid td {
  border: 1px solid ${p.border};
  padding: 4px 6px;
  vertical-align: top;
}
table.ep-meta-grid th {
  width: 28%;
  background: ${p.lightBg};
  color: ${p.muted};
  font-weight: 700;
}

.ep-charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}
.ep-block {
  border: 1px solid ${p.border};
  border-radius: 10px;
  padding: 10px;
  background: #fff;
  break-inside: avoid;
}
.ep-block h3 {
  margin: 0 0 6px;
  font-size: ${t.section};
  font-weight: 800;
  color: ${p.primaryNavy};
}

@media print {
  html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }
  body { margin: 0; }
}
`;
};

/** Vector-safe borders, tabular numerals, anti browser scaling — all executive PDFs */
export const executivePdfPrintQualityStyles = (): string => `
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  table.ep-grid,
  table.ep-mini,
  table.ep-meta-grid {
    border-collapse: collapse;
  }
  table.ep-grid th,
  table.ep-grid td,
  table.ep-mini th,
  table.ep-mini td {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    border-width: 1px;
    border-style: solid;
  }
  .ep-num,
  table.ep-grid td.ep-cell-num {
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1;
  }
}
.ep-continuation {
  font-size: ${EXECUTIVE_PDF_TYPOGRAPHY.footer};
  color: ${EXECUTIVE_PDF_PALETTE.muted};
  font-style: italic;
  margin: 0 0 4mm;
  break-after: avoid;
}
`;

export const executivePdfTableStyles = (isAr: boolean): string => {
  const p = EXECUTIVE_PDF_PALETTE;
  const t = EXECUTIVE_PDF_TYPOGRAPHY;
  const align = isAr ? "right" : "left";

  return `
.ep-table-wrap {
  width: 100%;
  overflow: visible;
  margin-top: ${EXECUTIVE_PDF_SPACING.tableTopMm}mm;
  text-align: center;
}
table.ep-grid {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  max-width: 100%;
  margin-inline: auto;
  font-size: ${t.table};
  line-height: ${t.tableLineHeight};
  direction: inherit;
}
table.ep-grid thead { display: table-header-group; }
table.ep-grid tbody { display: table-row-group; }
table.ep-grid th {
  background: ${p.tableHeadBg};
  color: ${p.tableHeadText};
  font-weight: 800;
  padding: 2.2mm 1.8mm;
  border: 1px solid ${p.primaryNavy};
  text-align: ${align};
  vertical-align: middle;
  white-space: normal;
}
table.ep-grid td {
  border: 1px solid ${p.border};
  padding: 1.6mm 1.8mm;
  text-align: ${align};
  vertical-align: middle;
  word-break: break-word;
  overflow-wrap: break-word;
}
table.ep-grid tbody tr.ep-row-alt td { background: ${p.rowAlt}; }
table.ep-grid tr { break-inside: avoid; page-break-inside: avoid; }
.ep-cell-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-height: 2.75em;
  line-height: 1.35;
  font-weight: 600;
}
.ep-cell-num {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-align: end;
}
table.ep-grid th.ep-cell-num { text-align: end; }

table.ep-mini {
  width: 100%;
  border-collapse: collapse;
  font-size: ${t.tableCompact};
  table-layout: fixed;
}
table.ep-mini th,
table.ep-mini td {
  border: 1px solid ${p.border};
  padding: 5px 7px;
  text-align: ${align};
  vertical-align: middle;
}
table.ep-mini th {
  background: ${p.headerBg};
  font-weight: 800;
}
table.ep-mini tbody tr:nth-child(even) td { background: ${p.rowAlt}; }
`;
};

/** Official `report-header.png` banner + report meta (no duplicated school/platform text). */
export const executivePdfOfficialHeaderStyles = (): string => {
  const p = EXECUTIVE_PDF_PALETTE;
  return `
.ep-official-header {
  margin: 0 0 ${EXECUTIVE_PDF_SPACING.tableTopMm}mm;
  break-inside: avoid;
  page-break-inside: avoid;
}
.ep-official-header--continuation {
  margin-bottom: ${EXECUTIVE_PDF_SPACING.sectionGapMm}mm;
}
.ep-official-header--compact .ep-official-meta {
  margin-top: 2mm;
}
.ep-official-header--compact .ep-title-main {
  font-size: ${EXECUTIVE_PDF_TYPOGRAPHY.h2};
}
.ep-official-banner {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  line-height: 0;
}
.ep-official-banner img {
  width: 100%;
  max-height: ${PDF_OFFICIAL_BANNER_HEIGHT_MM}mm;
  height: auto;
  object-fit: contain;
  object-position: top center;
  display: block;
  margin: 0 auto;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.ep-official-meta {
  margin-top: 3mm;
  text-align: center;
}
.ep-official-meta .ep-title-main {
  margin: 0 0 4px;
  font-size: ${EXECUTIVE_PDF_TYPOGRAPHY.h1};
  font-weight: ${EXECUTIVE_PDF_TYPOGRAPHY.h1Weight};
  line-height: 1.15;
  color: ${p.primaryNavy};
}
.ep-official-meta .ep-subtitle {
  margin: 0 0 4px;
}
.ep-official-meta .ep-meta-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 3mm 7mm;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  font-size: ${EXECUTIVE_PDF_TYPOGRAPHY.meta};
  color: ${p.muted};
}
.ep-official-meta .ep-meta-row li { margin: 0; }
.ep-official-meta .ep-meta-row strong { font-weight: 800; color: ${p.text}; }
.ep-official-header + .page-section,
.ep-official-header + .ep-note,
.ep-official-header + .ep-table-wrap,
.ep-official-header + .exec-panel {
  margin-top: 0;
}
/* Legacy class alias — routes to official header layout */
.ep-header { margin: 0 0 ${EXECUTIVE_PDF_SPACING.tableTopMm}mm; break-inside: avoid; page-break-inside: avoid; }
.ep-title-main {
  margin: 6px 0 0;
  font-size: ${EXECUTIVE_PDF_TYPOGRAPHY.h1};
  font-weight: ${EXECUTIVE_PDF_TYPOGRAPHY.h1Weight};
  line-height: 1.15;
  color: ${p.primaryNavy};
}
.ep-meta-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 3mm 7mm;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
  font-size: ${EXECUTIVE_PDF_TYPOGRAPHY.meta};
  color: ${p.muted};
}
.ep-meta-row li { margin: 0; }
.ep-meta-row strong { font-weight: 800; color: ${p.text}; }
`;
};

/** @deprecated use executivePdfOfficialHeaderStyles */
export const executivePdfHeaderStyles = executivePdfOfficialHeaderStyles;

export const executivePdfFooterStyles = (): string => {
  const p = EXECUTIVE_PDF_PALETTE;
  return `
.ep-footer {
  margin-top: ${EXECUTIVE_PDF_SPACING.footerTopMm}mm;
  padding-top: 3mm;
  border-top: 1px solid ${p.border};
  font-size: ${EXECUTIVE_PDF_TYPOGRAPHY.footer};
  color: ${p.subdued};
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 4mm;
  break-inside: avoid;
}
.ep-footer-brand {
  font-weight: 800;
  color: ${p.muted};
}
.ep-footer-dept {
  text-align: center;
  font-weight: 600;
}
.ep-footer-meta {
  text-align: end;
  font-variant-numeric: tabular-nums;
}
.ep-page-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 4mm;
  margin-top: 6mm;
  padding-top: 2mm;
  border-top: 1px solid ${p.border};
  font-size: ${EXECUTIVE_PDF_TYPOGRAPHY.footer};
  color: ${p.muted};
}
.ep-page-foot .ep-conf {
  font-weight: 700;
  color: ${p.text};
}
`;
};

/** Full stylesheet bundle for a standard executive document */
import { executivePdfAccessibilityStyles } from "@/lib/pdf/governance/executive-pdf-accessibility";

export const executivePdfStylesheet = (isAr: boolean): string =>
  [
    executivePdfBaseStyles(isAr),
    executivePdfOfficialHeaderStyles(),
    executivePdfFooterStyles(),
    executivePdfTableStyles(isAr),
    executivePdfPrintQualityStyles(),
    executivePdfAccessibilityStyles(),
  ].join("\n");
