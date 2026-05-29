/**
 * Executive multi-page PDF report layout — cover, TOC, sections, appendices.
 */

import { EXECUTIVE_REPORT_THEME } from "@/lib/analytics/export/analytics-report-theme";
import { executivePdfPageRule, executivePdfStylesheet } from "@/lib/pdf/executive-pdf-theme";
import { getPdfPageLayout } from "@/lib/pdf/pdf-page-layout-engine";
import { landscapeShellDocumentStyles } from "@/lib/pdf/components/ExecutiveLandscapePageShell";
import { buildReportCoverHtml } from "@/lib/analytics/export/analytics-report-cover-generator";
import { buildReportTocHtml } from "@/lib/analytics/export/analytics-report-toc";
import { pageNumberStyle } from "@/lib/analytics/export/analytics-report-pagination";
import {
  buildExecutiveSummarySection,
  buildReportSectionHtml,
  type ReportSectionBlock,
} from "@/lib/analytics/export/analytics-report-section-builder";

export type ExecutiveReportSectionId =
  | "cover"
  | "toc"
  | "executive_summary"
  | "kpis"
  | "historical"
  | "competition"
  | "student_excellence"
  | "equity"
  | "strategic"
  | "recommendations"
  | "appendix";

export type ExecutiveReportSection = {
  id: ExecutiveReportSectionId;
  titleAr: string;
  titleEn: string;
  pageBreakBefore: boolean;
  landscape?: boolean;
  optional?: boolean;
};

export const EXECUTIVE_REPORT_SECTIONS: ExecutiveReportSection[] = [
  { id: "cover", titleAr: "الغلاف", titleEn: "Cover", pageBreakBefore: false },
  { id: "toc", titleAr: "الفهرس", titleEn: "Contents", pageBreakBefore: true },
  { id: "executive_summary", titleAr: "الملخص التنفيذي", titleEn: "Executive Summary", pageBreakBefore: true },
  { id: "kpis", titleAr: "المؤشرات", titleEn: "KPIs", pageBreakBefore: true },
  { id: "historical", titleAr: "الذكاء التاريخي", titleEn: "Historical Intelligence", pageBreakBefore: true, landscape: true },
  { id: "competition", titleAr: "نتائج المسابقات", titleEn: "Competition Results", pageBreakBefore: true, landscape: true },
  { id: "student_excellence", titleAr: "تميز الطلاب", titleEn: "Student Excellence", pageBreakBefore: true, optional: true },
  { id: "equity", titleAr: "العدالة والفرص", titleEn: "Equity & Opportunity", pageBreakBefore: true },
  { id: "strategic", titleAr: "الذكاء الاستراتيجي", titleEn: "Strategic Intelligence", pageBreakBefore: true },
  { id: "recommendations", titleAr: "التوصيات", titleEn: "Recommendations", pageBreakBefore: true },
  { id: "appendix", titleAr: "الملحق", titleEn: "Appendix", pageBreakBefore: true, landscape: true },
];

export type ComposeExecutiveReportInput = {
  isAr: boolean;
  title: string;
  subtitle: string;
  generatedAt: string;
  yearsLabel?: string;
  activityLabel?: string;
  summary?: {
    kpis: string[];
    risks: string[];
    opportunities: string[];
    recommendations: string[];
  };
  sections: ReportSectionBlock[];
};

export const composeExecutiveReportDocument = (input: ComposeExecutiveReportInput): string => {
  const dir = input.isAr ? "rtl" : "ltr";
  const lang = input.isAr ? "ar" : "en";
  const theme = EXECUTIVE_REPORT_THEME;

  const cover = buildReportCoverHtml({
    isAr: input.isAr,
    title: input.title,
    subtitle: input.subtitle,
    yearsLabel: input.yearsLabel,
    activityLabel: input.activityLabel,
    generatedAt: input.generatedAt,
  });

  const tocEntries = input.sections.map((s) => ({
    id: s.id,
    title: input.isAr ? s.titleAr : s.titleEn,
  }));
  const toc = buildReportTocHtml(input.isAr, [{ id: "executive_summary", title: input.isAr ? "الملخص" : "Summary" }, ...tocEntries]);

  const summaryHtml = input.summary
    ? buildExecutiveSummarySection({ isAr: input.isAr, ...input.summary })
    : "";

  const bodySections = input.sections.map((s) => buildReportSectionHtml(s, input.isAr)).join("");

  const portrait = getPdfPageLayout("portrait");
  const landscape = getPdfPageLayout("landscape");
  const portraitMargin = `${portrait.marginTop}mm ${portrait.marginLeft}mm ${portrait.marginBottom + 8}mm ${portrait.marginRight}mm`;
  const landscapeMargin = `${landscape.marginTop}mm ${landscape.marginLeft}mm ${landscape.marginBottom + 8}mm ${landscape.marginRight}mm`;

  return `<!DOCTYPE html><html dir="${dir}" lang="${lang}"><head><meta charset="utf-8"/>
<style>
${pageNumberStyle()}
${executivePdfPageRule("portrait")}
${executivePdfPageRule("landscape")}
${executivePdfStylesheet(input.isAr)}
${landscapeShellDocumentStyles()}
@page portrait { size: A4 portrait; margin: ${portraitMargin}; }
@page landscape { size: A4 landscape; margin: ${landscapeMargin}; }
body { font-family: ${theme.fontFamily}; font-size: ${theme.typography.body}; color: ${theme.colors.text}; counter-reset: page; }
.cover-page { page: portrait; min-height: 240mm; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; }
.cover-page h1 { font-size: ${theme.typography.coverTitle}; color: ${theme.colors.coverAccent}; margin: 12px 0; }
.cover-page .subtitle { font-size: ${theme.typography.h2}; color: ${theme.colors.muted}; }
.report-section { page-break-before: always; margin-bottom: ${theme.spacing.sectionGap}; }
.landscape-section { page: landscape; }
.landscape-section .ep-landscape-stage { max-width: 100%; margin-inline: auto; }
.portrait-section { page: portrait; }
h2 { font-size: ${theme.typography.h2}; border-bottom: 1px solid ${theme.colors.border}; padding-bottom: 4px; }
.toc ol { padding-${dir === "rtl" ? "right" : "left"}: 1.2rem; }
.toc li { margin: 4px 0; display:flex; justify-content:space-between; gap:8px; }
.continuation { font-size: ${theme.typography.small}; color: ${theme.colors.muted}; font-style: italic; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid ${theme.colors.border}; padding: 4px 6px; text-align: center; }
thead { display: table-header-group; }
.summary-block { margin-bottom: 12px; }
</style></head><body>
${cover}
${toc}
<section id="executive_summary" class="report-section portrait-section"><h2>${input.isAr ? "الملخص التنفيذي" : "Executive Summary"}</h2>${summaryHtml}</section>
${bodySections}
</body></html>`;
};

/** @deprecated use composeExecutiveReportDocument */
export const buildExecutiveReportHtmlShell = (input: {
  isAr: boolean;
  title: string;
  subtitle: string;
  sections: Array<{ id: ExecutiveReportSectionId; html: string }>;
}): string =>
  composeExecutiveReportDocument({
    isAr: input.isAr,
    title: input.title,
    subtitle: input.subtitle,
    generatedAt: new Date().toLocaleDateString(input.isAr ? "ar-SA" : "en-GB"),
    sections: input.sections.map((s) => {
      const meta = EXECUTIVE_REPORT_SECTIONS.find((x) => x.id === s.id);
      return {
        id: s.id,
        titleAr: meta?.titleAr ?? s.id,
        titleEn: meta?.titleEn ?? s.id,
        html: s.html,
        landscape: meta?.landscape,
      };
    }),
  });

export const activityReportPage = (input: {
  isAr: boolean;
  activityLabel: string;
  yearLabel: string;
  tableHtml: string;
  summaryHtml?: string;
  continuation?: string;
}): string => {
  const h = input.isAr ? "نشاط" : "Activity";
  const y = input.isAr ? "السنة" : "Year";
  return `<h3>${h}: ${input.activityLabel} · ${y}: ${input.yearLabel}</h3>
${input.continuation ?? ""}
${input.summaryHtml ?? ""}
${input.tableHtml}`;
};
