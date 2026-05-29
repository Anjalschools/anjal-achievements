/**
 * Official PDF header — `public/report-header.png` is the single source of truth.
 * No duplicate school / platform text (already inside the image).
 */

import { PUBLIC_IMG } from "@/lib/publicImages";
import { escapeHtml } from "@/lib/pdf/executive-pdf-escape";

/** Canonical path — always use this unless explicitly overridden in tests. */
export const OFFICIAL_REPORT_HEADER_PATH = PUBLIC_IMG.reportHeader;

/** Measured safe height for `report-header.png` at full page width (mm). */
export const PDF_OFFICIAL_BANNER_HEIGHT_MM = 28;

/** Title + report meta band below the banner (mm). */
export const PDF_OFFICIAL_META_BAND_FULL_MM = 18;

export const PDF_OFFICIAL_META_BAND_COMPACT_MM = 10;

export const pdfOfficialHeaderTotalMm = (compact = false): number =>
  PDF_OFFICIAL_BANNER_HEIGHT_MM + (compact ? PDF_OFFICIAL_META_BAND_COMPACT_MM : PDF_OFFICIAL_META_BAND_FULL_MM);

export type OfficialReportHeaderInput = {
  isAr: boolean;
  /** Activity / competition name — report subject */
  competitionName: string;
  reportTypeLabel?: string;
  academicYears?: string;
  outcomeLine?: string;
  sectionLabel?: string;
  filterSummary?: string;
  generatedAt?: string;
  /** Defaults to OFFICIAL_REPORT_HEADER_PATH */
  headerBannerPath?: string;
  /** Continuation pages — smaller meta band, same banner */
  compact?: boolean;
};

export const buildOfficialReportHeaderBanner = (
  headerBannerPath: string = OFFICIAL_REPORT_HEADER_PATH
): string =>
  `<div class="ep-official-banner"><img src="${escapeHtml(headerBannerPath)}" alt="" /></div>`;

/** True when HTML uses the canonical `report-header.png` banner (not legacy text headers). */
export const hasOfficialReportHeaderMarker = (html: string): boolean =>
  html.includes('data-official-report-header="1"') ||
  html.includes("ep-official-header") ||
  html.includes(OFFICIAL_REPORT_HEADER_PATH);

/**
 * Continuation pages — official banner only (no duplicated school/platform text).
 */
export const buildOfficialReportContinuationHeader = (
  headerBannerPath: string = OFFICIAL_REPORT_HEADER_PATH
): string =>
  `<header class="ep-official-header ep-official-header--continuation" data-official-report-header="1">
  ${buildOfficialReportHeaderBanner(headerBannerPath)}
</header>`;

/**
 * Full official header: banner image + report title/meta only (no duplicated branding).
 */
export const buildOfficialReportHeader = (input: OfficialReportHeaderInput): string => {
  const {
    isAr,
    competitionName,
    reportTypeLabel,
    academicYears,
    outcomeLine,
    sectionLabel,
    filterSummary,
    generatedAt,
    headerBannerPath = OFFICIAL_REPORT_HEADER_PATH,
    compact = false,
  } = input;

  const reportLabel = reportTypeLabel ?? (isAr ? "تقرير تنفيذي" : "Executive report");
  const mainTitle = isAr ? `تقرير تنفيذي — ${competitionName}` : `Executive report — ${competitionName}`;

  const subtitleParts: string[] = [];
  if (academicYears) subtitleParts.push(academicYears);
  if (outcomeLine) subtitleParts.push(outcomeLine);
  if (sectionLabel) subtitleParts.push(sectionLabel);
  const subtitle =
    subtitleParts.length > 0
      ? `<p class="ep-subtitle" dir="auto">${subtitleParts.map((p) => escapeHtml(p)).join(isAr ? " · " : " · ")}</p>`
      : "";

  const metaItems: string[] = [
    `<li><strong>${escapeHtml(isAr ? "نوع التقرير" : "Report type")}:</strong> ${escapeHtml(reportLabel)}</li>`,
  ];
  if (generatedAt) {
    metaItems.push(
      `<li><strong>${escapeHtml(isAr ? "تاريخ التصدير" : "Export date")}:</strong> ${escapeHtml(generatedAt)}</li>`
    );
  }
  if (filterSummary) {
    metaItems.push(
      `<li><strong>${escapeHtml(isAr ? "الفلاتر" : "Filters")}:</strong> ${escapeHtml(filterSummary)}</li>`
    );
  }

  const compactClass = compact ? " ep-official-header--compact" : "";

  return `<header class="ep-official-header${compactClass}" data-official-report-header="1">
  ${buildOfficialReportHeaderBanner(headerBannerPath)}
  <div class="ep-official-meta">
    <h1 class="ep-title-main" dir="auto">${escapeHtml(mainTitle)}</h1>
    ${subtitle}
    <ul class="ep-meta-row">${metaItems.join("")}</ul>
  </div>
</header>`;
};

/** @deprecated alias */
export const buildStandardReportHeader = buildOfficialReportHeader;

export type ExecutivePdfHeaderInput = OfficialReportHeaderInput;

/** @deprecated alias — routes to official header */
export const buildExecutivePdfHeader = buildOfficialReportHeader;

export const buildExecutiveReportMainTitle = (isAr: boolean, competitionName: string): string =>
  isAr ? `تقرير تنفيذي — ${competitionName}` : `Executive report — ${competitionName}`;
