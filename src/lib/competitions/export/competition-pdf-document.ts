/**
 * Competition executive PDF document — vector HTML + print composition layer.
 */

import type { CompetitionTableModel } from "@/lib/analytics/competition-table-engine";
import { competitionTableColumnKey } from "@/lib/analytics/competition-table-engine";
import { formatAcademicYearRangeLabel } from "@/lib/analytics/competition-year-normalizer";
import { EXECUTIVE_REPORT_THEME } from "@/lib/analytics/export/analytics-report-theme";
import { buildStandardReportHeader } from "@/lib/pdf/components/ExecutivePdfHeader";
import { buildOfficialReportContinuationHeader } from "@/lib/pdf/report-header-standard";
import { executivePdfOfficialHeaderStyles, EXECUTIVE_PDF_PALETTE } from "@/lib/pdf/executive-pdf-theme";
import {
  getPdfPageLayout,
  PDF_STANDARD_CONTINUATION_HEADER_MM,
  PDF_STANDARD_FOOTER_HEIGHT_MM,
  PDF_STANDARD_HEADER_HEIGHT_MM,
} from "@/lib/pdf/pdf-page-layout-engine";
import {
  buildCompetitionPdfLayoutPlan,
  COMPETITION_PDF_PAGE,
  type CompetitionPdfOrientation,
  type CompetitionPdfTableChunk,
  assertCompetitionPdfLayoutReady,
} from "@/lib/competitions/export/competition-pdf-layout-engine";

export type CompetitionTablePdfMetadata = {
  sectionTitleAr?: string;
  sectionTitleEn?: string;
  yearsLabel?: string;
  filterSummaryAr?: string;
  filterSummaryEn?: string;
  generatedAt?: string;
};

const portraitLayout = getPdfPageLayout("portrait");
const landscapeLayout = getPdfPageLayout("landscape");

/** Print composition — margins, rhythm, vertical balance (single source for @page + layout) */
export const PDF_PAGE_COMPOSITION = {
  margins: {
    portrait: {
      topMm: portraitLayout.marginTop,
      bottomMm: portraitLayout.marginBottom,
      sideMm: portraitLayout.marginLeft,
    },
    landscape: {
      topMm: landscapeLayout.marginTop,
      bottomMm: landscapeLayout.marginBottom,
      sideMm: landscapeLayout.marginLeft,
    },
  },
  rhythm: {
    sectionGapMm: 6,
    headerToKpiMm: 5,
    kpiToTableMm: 7,
    tableToFooterMm: 6,
    opticalHeaderPadMm: 2,
  },
  typography: {
    org: "9px",
    title: "17px",
    subtitle: "12px",
    sectionTitle: "12px",
    meta: "9px",
    kpiLabel: "9px",
    kpiValue: "12px",
    footer: "9px",
  },
  /** When slack exceeds this, vertically center the table block */
  verticalCenterSlackThresholdMm: 28,
  /** Minimum top inset before centering kicks in on dense pages */
  densePageTopInsetMm: 4,
} as const;

export type PrintPageRole = "cover" | "continuation";

export type PageCompositionInput = {
  orientation: CompetitionPdfOrientation;
  role: PrintPageRole;
  rowCount: number;
  tableHeightMm: number;
  includeHeader: boolean;
  includeKpi: boolean;
  chunkIndex: number;
  chunkTotal: number;
};

export type PageCompositionPlan = {
  printableHeightMm: number;
  printableWidthMm: number;
  pageClass: string;
  innerStyle: string;
  tableStageStyle: string;
  tableCenterClass: string;
  headerCompact: boolean;
};

const escapeHtml = (v: string): string =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const HEADER_BLOCK_MM = PDF_STANDARD_HEADER_HEIGHT_MM;
const CONTINUATION_HEADER_BLOCK_MM = PDF_STANDARD_CONTINUATION_HEADER_MM;
const KPI_BAND_MM = 24;
const FOOTER_BLOCK_MM = PDF_STANDARD_FOOTER_HEIGHT_MM;
const TABLE_HEADER_ROWS_MM = 14;
const TABLE_ROW_MM = 7.2;

export const estimateTableHeightMm = (rowCount: number): number =>
  TABLE_HEADER_ROWS_MM + rowCount * TABLE_ROW_MM;

export const composePageComposition = (input: PageCompositionInput): PageCompositionPlan => {
  const page = COMPETITION_PDF_PAGE[input.orientation];
  const printableHeightMm = page.printableHeightMm;
  const printableWidthMm = page.usableWidthMm;

  let contentMm = input.tableHeightMm + FOOTER_BLOCK_MM;
  if (input.includeHeader) {
    contentMm +=
      input.role === "continuation" ? CONTINUATION_HEADER_BLOCK_MM : HEADER_BLOCK_MM;
  }
  if (input.includeKpi) contentMm += KPI_BAND_MM;
  contentMm += PDF_PAGE_COMPOSITION.rhythm.sectionGapMm * 2;

  const slackMm = printableHeightMm - contentMm;
  const isSparse = slackMm >= PDF_PAGE_COMPOSITION.verticalCenterSlackThresholdMm;
  const isContinuation = input.role === "continuation";

  const pageClasses = ["ct-print-page"];
  if (isContinuation) pageClasses.push("ct-print-page--continuation");
  else pageClasses.push("ct-print-page--cover");
  if (isSparse) pageClasses.push("ct-print-page--balanced");

  const topInset =
    !isSparse && !isContinuation
      ? PDF_PAGE_COMPOSITION.densePageTopInsetMm
      : isSparse
        ? Math.min(Math.round(slackMm * 0.35), 18)
        : PDF_PAGE_COMPOSITION.rhythm.opticalHeaderPadMm;

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
    tableCenterClass: "ct-table-center",
    headerCompact: isContinuation,
  };
};

const METRIC_HEADER_BG: Record<string, { bg: string; text: string }> = {
  participants: { bg: "#f1f5f9", text: "#1e293b" },
  gold: { bg: "#fef3c7", text: "#78350f" },
  silver: { bg: "#e2e8f0", text: "#1e293b" },
  bronze: { bg: "#ffedd5", text: "#9a3412" },
  total: { bg: "#ffe4e6", text: "#9f1239" },
  accepted: { bg: "#d1fae5", text: "#065f46" },
};

const metricHeaderStyle = (metricKey: string): string => {
  const p = METRIC_HEADER_BG[metricKey] ?? { bg: "#e0f2fe", text: "#0c4a6e" };
  return `background:${p.bg};color:${p.text}`;
};

const formatCellValue = (value: number): string => (value > 0 ? String(value) : "—");

const buildColgroup = (chunk: CompetitionPdfTableChunk): string => {
  const cols = [
    `<col style="width:${chunk.stageWidthMm}mm" />`,
    ...chunk.yearGroupLayouts.flatMap((yg) =>
      yg.columns.map((c) => `<col style="width:${c.widthMm}mm" />`)
    ),
  ];
  return `<colgroup>${cols.join("")}</colgroup>`;
};

const buildTableHead = (chunk: CompetitionPdfTableChunk, isAr: boolean): string => {
  const stageLabel = isAr ? "المرحلة" : "Stage";
  let row1 = `<tr><th rowspan="2" class="ct-stage">${escapeHtml(stageLabel)}</th>`;
  chunk.yearGroupLayouts.forEach((yg, yIdx) => {
    const sep = yIdx > 0 ? " ct-year-sep" : "";
    row1 += `<th colspan="${yg.columns.length}" class="ct-year${sep}">${escapeHtml(isAr ? yg.labelAr : yg.labelEn)}</th>`;
  });
  row1 += "</tr>";
  let row2 = "<tr>";
  chunk.yearGroupLayouts.forEach((yg, yIdx) => {
    yg.columns.forEach((col, cIdx) => {
      const sep = yIdx > 0 && cIdx === 0 ? " ct-year-sep" : "";
      const totalClass = col.isTotalColumn ? " ct-metric-total" : "";
      row2 += `<th class="ct-metric${sep}${totalClass}" style="${metricHeaderStyle(col.metricKey)}">${escapeHtml(isAr ? col.labelAr : col.labelEn)}</th>`;
    });
  });
  row2 += "</tr>";
  return `<thead>${row1}${row2}</thead>`;
};

const buildTableBody = (
  model: CompetitionTableModel,
  chunk: CompetitionPdfTableChunk,
  isAr: boolean
): string => {
  const rows = model.rows
    .map((row, rowIdx) => {
      const isTotal = Boolean(row.isTotal);
      const trClass = isTotal ? "ct-row-total" : rowIdx % 2 === 1 ? "ct-row-alt" : "ct-row-data";
      let cells = `<td class="ct-stage-cell">${escapeHtml(isAr ? row.labelAr : row.labelEn)}</td>`;
      chunk.yearGroups.forEach((yg, yIdx) => {
        yg.columns.forEach((col, cIdx) => {
          const ck = competitionTableColumnKey(yg.year, col.key);
          const value = row.cells[ck] ?? 0;
          const sep = yIdx > 0 && cIdx === 0 ? " ct-year-sep" : "";
          const totalClass = col.key === "total" ? " ct-value-total" : "";
          const bg = metricHeaderStyle(col.key).split(";")[0] ?? "";
          cells += `<td class="ct-value${sep}${totalClass}" style="${bg}">${formatCellValue(value)}</td>`;
        });
      });
      return `<tr class="${trClass}">${cells}</tr>`;
    })
    .join("");
  return `<tbody>${rows}</tbody>`;
};

const buildChunkTable = (
  model: CompetitionTableModel,
  chunk: CompetitionPdfTableChunk,
  isAr: boolean
): string => {
  const continuation =
    chunk.chunkTotal > 1
      ? `<p class="ct-continuation">${escapeHtml(
          isAr
            ? `تابع — جدول ${chunk.chunkIndex + 1} من ${chunk.chunkTotal}`
            : `Continued — table ${chunk.chunkIndex + 1} of ${chunk.chunkTotal}`
        )}</p>`
      : "";

  return `${continuation}
<table class="ct-grid" style="width:${chunk.tableWidthMm}mm;font-size:${chunk.fontSizePx}px">
${buildColgroup(chunk)}
${buildTableHead(chunk, isAr)}
${buildTableBody(model, chunk, isAr)}
</table>`;
};

const buildKpiSection = (model: CompetitionTableModel, isAr: boolean): string => {
  const m = model.metrics;
  const items: Array<{ label: string; value: string }> = [
    {
      label: isAr ? "جودة النتائج" : "Quality score",
      value: `${m.qualityScore}/100`,
    },
  ];
  if (m.medalDensityPct != null) {
    items.push({
      label: isAr ? "كثافة الجوائز" : "Medal density",
      value: `${m.medalDensityPct}%`,
    });
  }
  if (m.growthRatePct != null) {
    items.push({
      label: isAr ? "النمو السنوي" : "YoY growth",
      value: `${m.growthRatePct > 0 ? "+" : ""}${m.growthRatePct}%`,
    });
  }
  if (m.bestYear != null) {
    items.push({
      label: isAr ? "أفضل سنة" : "Best year",
      value: formatAcademicYearRangeLabel(m.bestYear),
    });
  }

  const cards = items
    .map(
      (item) =>
        `<div class="ct-kpi-card"><span class="ct-kpi-label">${escapeHtml(item.label)}</span><span class="ct-kpi-value">${escapeHtml(item.value)}</span></div>`
    )
    .join("");

  return `<div class="ct-kpi-band"><div class="ct-kpi-grid">${cards}</div></div>`;
};

const buildMetadataBlock = (
  model: CompetitionTableModel,
  isAr: boolean,
  meta: CompetitionTablePdfMetadata | undefined,
  compact: boolean
): string => {
  const title = isAr ? model.competitionTitleAr : model.competitionTitleEn;
  const section =
    (isAr ? meta?.sectionTitleAr : meta?.sectionTitleEn) ??
    (isAr ? "قسم البنين والبنات" : "Boys and girls section");
  const years =
    meta?.yearsLabel ??
    model.years.map((y) => formatAcademicYearRangeLabel(y)).join(isAr ? " · " : ", ");
  const generated =
    meta?.generatedAt ??
    new Date(model.generatedAt).toLocaleDateString(isAr ? "ar-SA" : "en-GB", {
      dateStyle: "medium",
    });
  const filters = isAr ? meta?.filterSummaryAr : meta?.filterSummaryEn;

  return buildStandardReportHeader({
    isAr,
    competitionName: title,
    reportTypeLabel: isAr ? "إحصائيات ونتائج المسابقات" : "Competition statistics report",
    sectionLabel: section,
    academicYears: years,
    filterSummary: filters,
    generatedAt: generated,
    compact,
  });
};

const buildPageFooter = (isAr: boolean, pageNote?: string): string => {
  const note = pageNote ? `<p class="ct-page-note">${escapeHtml(pageNote)}</p>` : "";
  return `<footer class="ct-page-footer ct-page-footer--unified">
  ${note}
  <p class="ct-footer-brand">${escapeHtml(isAr ? "منصة تميز الأنجال" : "Al-Anjal Excellence Platform")}</p>
  <p class="ct-footer-dept">${escapeHtml(isAr ? "قسم الحاسب بمدارس الأنجال الأهلية" : "IT Department — Al-Anjal Schools")}</p>
  <p class="ct-footer-type">${escapeHtml(isAr ? "إحصائيات ونتائج المسابقات" : "Competition statistics report")}</p>
</footer>`;
};

const buildPrintPage = (input: {
  composition: PageCompositionPlan;
  headerHtml: string;
  kpiHtml: string;
  sectionTitle: string;
  tableHtml: string;
  footerHtml: string;
  isAr: boolean;
}): string => {
  const { composition } = input;
  return `<div class="${composition.pageClass}" data-print-page>
  <div class="ct-page-inner" style="${composition.innerStyle}">
    ${input.headerHtml}
    ${input.kpiHtml}
    <div class="ct-table-stage" style="${composition.tableStageStyle}">
      <div class="${composition.tableCenterClass}">
        <h2 class="ct-section-title">${escapeHtml(input.sectionTitle)}</h2>
        <div class="ct-table-wrap">${input.tableHtml}</div>
      </div>
    </div>
    ${input.footerHtml}
  </div>
</div>`;
};

const competitionPdfStyles = (orientation: CompetitionPdfOrientation): string => {
  const theme = EXECUTIVE_REPORT_THEME;
  const palette = EXECUTIVE_PDF_PALETTE;
  const m = PDF_PAGE_COMPOSITION.margins[orientation];
  const p = PDF_PAGE_COMPOSITION;
  const page = COMPETITION_PDF_PAGE[orientation];

  const pageRule = `@page {
  size: A4 ${orientation};
  margin: ${m.topMm}mm ${m.sideMm}mm ${m.bottomMm}mm ${m.sideMm}mm;
}`;

  return `${pageRule}
${executivePdfOfficialHeaderStyles()}
@page {
  @bottom-center {
    content: counter(page) " / " counter(pages);
    font-size: ${p.typography.footer};
    color: ${theme.colors.muted};
    font-family: ${theme.fontFamily};
  }
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
body {
  font-family: "Noto Naskh Arabic", "Segoe UI", Tahoma, "Arial Unicode MS", ${theme.fontFamily};
  font-size: ${theme.typography.body};
  color: ${theme.colors.text};
  background: #fff;
  line-height: 1.45;
}

.ct-print-page {
  width: 100%;
  max-width: ${page.usableWidthMm}mm;
  margin: 0 auto;
  page-break-after: always;
  break-after: page;
}
.ct-print-page:last-child {
  page-break-after: auto;
  break-after: auto;
}

.ct-page-inner {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: ${page.usableWidthMm}mm;
  margin-inline: auto;
}

.ct-print-page--balanced .ct-page-inner {
  justify-content: space-between;
}

.ct-report-header {
  text-align: center;
  margin: 0 auto ${p.rhythm.headerToKpiMm}mm;
  padding-bottom: ${p.rhythm.sectionGapMm}mm;
  border-bottom: 2px solid ${palette.executiveBlue};
  max-width: 96%;
}
.ct-report-header--compact {
  margin-bottom: ${p.rhythm.sectionGapMm}mm;
  padding-bottom: 4px;
}
.ct-report-header--compact .ct-title { font-size: ${p.typography.sectionTitle}; }
.ct-report-header--compact .ct-subtitle,
.ct-report-header--compact .ct-org { display: none; }

.ct-org {
  font-size: ${p.typography.org};
  color: ${theme.colors.muted};
  margin: 0 0 3px;
  letter-spacing: 0.02em;
}
.ct-title {
  font-size: ${p.typography.title};
  margin: 0 0 4px;
  color: ${palette.primaryNavy};
  font-weight: 800;
  line-height: 1.25;
  text-align: center;
}
.ct-subtitle {
  font-size: ${p.typography.subtitle};
  margin: 0 0 6px;
  color: ${theme.colors.muted};
  font-weight: 600;
  text-align: center;
}
.ct-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 20px;
  margin: 0 auto;
  font-size: ${p.typography.meta};
  max-width: 520px;
}
.ct-meta-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 100px;
}
.ct-meta dt {
  font-weight: 700;
  color: ${theme.colors.muted};
  margin: 0;
}
.ct-meta dd {
  margin: 1px 0 0;
  font-weight: 700;
  color: ${theme.colors.text};
}

.ct-kpi-band {
  width: 100%;
  margin: 0 auto ${p.rhythm.kpiToTableMm}mm;
  max-width: ${page.usableWidthMm}mm;
}
.ct-kpi-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: stretch;
  gap: 8px;
  margin: 0 auto;
}
.ct-kpi-card {
  flex: 1 1 110px;
  max-width: 160px;
  min-width: 100px;
  border: 1px solid ${theme.colors.border};
  border-radius: 6px;
  padding: 7px 10px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  text-align: center;
}
.ct-kpi-label {
  display: block;
  font-size: ${p.typography.kpiLabel};
  color: ${theme.colors.muted};
  font-weight: 600;
}
.ct-kpi-value {
  display: block;
  font-size: ${p.typography.kpiValue};
  font-weight: 800;
  margin-top: 3px;
  color: ${theme.colors.text};
}

.ct-table-stage {
  width: 100%;
  margin-bottom: ${p.rhythm.tableToFooterMm}mm;
}
.ct-table-center {
  width: 100%;
  max-width: 100%;
  text-align: center;
}
.ct-section-title {
  font-size: ${p.typography.sectionTitle};
  font-weight: 800;
  margin: 0 auto 6px;
  text-align: center;
  color: ${theme.colors.text};
  max-width: 90%;
}
.ct-continuation {
  font-size: ${p.typography.meta};
  color: ${theme.colors.muted};
  font-style: italic;
  margin: 0 auto 5px;
  text-align: center;
}
.ct-table-wrap {
  display: inline-block;
  margin-inline: auto;
  text-align: start;
  max-width: 100%;
}

table.ct-grid {
  border-collapse: collapse;
  table-layout: fixed;
  margin-inline: auto;
  direction: inherit;
}
thead { display: table-header-group; }
tr { page-break-inside: avoid; break-inside: avoid; }
th, td {
  border: 1px solid #1e293b;
  padding: 6px 5px;
  text-align: center;
  vertical-align: middle;
  line-height: 1.4;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
th.ct-stage, td.ct-stage-cell {
  font-weight: 800;
  background: #bae6fd !important;
  min-width: 30mm;
  text-align: start;
  padding-inline: 8px;
}
th.ct-year {
  font-weight: 800;
  background: #7dd3fc !important;
  border-bottom: 2px solid #0f172a;
  letter-spacing: 0.01em;
}
th.ct-year-sep, td.ct-year-sep {
  border-inline-start: 2.5px solid #0f172a;
  box-shadow: inset 3px 0 0 rgba(15, 23, 42, 0.06);
}
th.ct-metric { font-weight: 700; font-size: 0.92em; }
th.ct-metric-total, td.ct-value-total {
  font-weight: 800;
  border-inline-start: 1.5px solid #64748b;
}
td.ct-value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-feature-settings: "tnum" 1;
}
.ct-row-alt td { background: #f8fafc; }
.ct-row-total td {
  background: #fed7aa !important;
  font-weight: 800;
  border-top: 2px solid #9a3412;
}

.ct-page-footer {
  margin-top: auto;
  padding-top: ${p.rhythm.tableToFooterMm}mm;
  flex-shrink: 0;
  text-align: center;
  width: 100%;
}
.ct-page-note {
  font-size: ${p.typography.meta};
  color: ${theme.colors.muted};
  margin: 0 0 4px;
}
.ct-footer-brand {
  font-size: ${p.typography.footer};
  color: ${theme.colors.muted};
  margin: 0;
  font-weight: 600;
}`;
};

export const buildCompetitionTablePrintHtml = (
  model: CompetitionTableModel,
  isAr: boolean,
  meta?: CompetitionTablePdfMetadata
): string => {
  assertCompetitionPdfLayoutReady(model);
  const plan = buildCompetitionPdfLayoutPlan(model);
  const dir = isAr ? "rtl" : "ltr";
  const lang = isAr ? "ar" : "en";

  if (plan.chunks.length === 0) {
    return `<!DOCTYPE html><html dir="${dir}" lang="${lang}"><head><meta charset="utf-8"/><body><p>${escapeHtml(isAr ? "لا توجد بيانات للتصدير" : "No data to export")}</p></body></html>`;
  }

  const rowCount = model.rows.length;
  const pages = plan.chunks.map((chunk, idx) => {
    const isFirst = idx === 0;
    const role: PrintPageRole = isFirst ? "cover" : "continuation";
    const tableHeightMm = estimateTableHeightMm(rowCount);

    const composition = composePageComposition({
      orientation: plan.orientation,
      role,
      rowCount,
      tableHeightMm,
      includeHeader: true,
      includeKpi: isFirst,
      chunkIndex: chunk.chunkIndex,
      chunkTotal: chunk.chunkTotal,
    });

    const sectionTitle =
      plan.chunks.length > 1
        ? isAr
          ? `ملخص المسابقة — سنوات ${chunk.yearGroups.map((y) => y.year).join("، ")}`
          : `Competition summary — years ${chunk.yearGroups.map((y) => y.year).join(", ")}`
        : isAr
          ? "ملخص المسابقة التنفيذي"
          : "Executive competition summary";

    const pageNote =
      plan.chunks.length > 1
        ? isAr
          ? `الجزء ${idx + 1} من ${plan.chunks.length}`
          : `Part ${idx + 1} of ${plan.chunks.length}`
        : undefined;

    return buildPrintPage({
      composition,
      headerHtml: isFirst
        ? buildMetadataBlock(model, isAr, meta, false)
        : buildOfficialReportContinuationHeader(),
      kpiHtml: isFirst ? buildKpiSection(model, isAr) : "",
      sectionTitle,
      tableHtml: buildChunkTable(model, chunk, isAr),
      footerHtml: buildPageFooter(isAr, pageNote),
      isAr,
    });
  });

  return `<!DOCTYPE html><html dir="${dir}" lang="${lang}"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(isAr ? model.competitionTitleAr : model.competitionTitleEn)}</title>
<style>${competitionPdfStyles(plan.orientation)}</style>
</head><body>
${pages.join("\n")}
</body></html>`;
};

export const openCompetitionTablePrintWindow = (html: string): void => {
  void import("@/lib/pdf/executive-pdf-print").then(({ printExecutivePdfHtml }) => {
    void printExecutivePdfHtml(html);
  });
};
