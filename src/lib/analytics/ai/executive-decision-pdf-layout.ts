import { buildExecutiveDecisionReportSections } from "@/lib/analytics/ai/executive-decision-report-builder";
import type { AiDecisionEngineResult } from "@/lib/analytics/ai/ai-decision-schema";
import { buildExecutiveLandscapePageShell } from "@/lib/pdf/components/ExecutiveLandscapePageShell";
import {
  buildExecutiveKpiGridHtml,
  buildExecutiveSummaryPanelHtml,
  executiveKpiPanelStyles,
} from "@/lib/pdf/components/ExecutivePdfKpiGrid";
import { buildExecutiveMiniTableHtml } from "@/lib/pdf/components/ExecutivePdfTable";
import { buildGenericTableHtml } from "@/lib/pdf/executive-pdf-layout-hardening";
import { executivePdfTableStyles } from "@/lib/pdf/executive-pdf-theme";
import { escapeHtml } from "@/lib/pdf/executive-pdf-escape";

export const buildExecutiveDecisionPdfDocument = (
  result: AiDecisionEngineResult,
  title: string,
  isAr: boolean,
  headerImagePath?: string
): string => {
  const generatedAt = new Date().toLocaleString(isAr ? "ar-SA" : "en-GB");
  const sections = buildExecutiveDecisionReportSections(result);
  const { bundle, boardSummary } = result;

  const kpi = buildExecutiveKpiGridHtml(
    [
      {
        label: isAr ? "عدد القرارات" : "Decisions",
        value: String(bundle.decisions.length),
      },
      {
        label: isAr ? "أولويات عليا" : "Top priorities",
        value: String(bundle.topPriorities.length),
      },
      {
        label: isAr ? "مخاطر حرجة" : "Critical risks",
        value: String(bundle.criticalRisks.length),
      },
      {
        label: isAr ? "ثقة عالية" : "High confidence",
        value: String(bundle.decisions.filter((d) => d.confidence === "HIGH").length),
      },
    ],
    4
  );

  const boardSummaryHtml = buildExecutiveSummaryPanelHtml(
    isAr,
    [
      isAr ? boardSummary.headlineAr : boardSummary.headlineEn,
      isAr ? boardSummary.bestInvestmentAr : boardSummary.bestInvestmentEn,
    ],
    isAr ? "ملخص مجلس الإدارة" : "Board summary"
  );

  const sectionBlocks = sections
    .map((sec) => {
      const secTitle = isAr ? sec.titleAr : sec.titleEn;
      const table = buildExecutiveMiniTableHtml({
        isAr,
        headers: isAr ? ["البند", "القيمة"] : ["Item", "Value"],
        rows: sec.rows.map((r) => ({
          label: isAr ? r.labelAr : r.labelEn,
          value: r.value,
        })),
      });
      return `<section class="page-section page-section--flow"><h2 class="ep-h2">${escapeHtml(secTitle)}</h2>${table}</section>`;
    })
    .join("");

  const decisionHeaders = isAr
    ? ["القرار", "الشدة", "الثقة", "الملخص", "الأثر المتوقع"]
    : ["Decision", "Severity", "Confidence", "Summary", "Expected outcome"];

  const decisionRows = bundle.decisions.map((d) => ({
    [decisionHeaders[0]!]: isAr ? d.titleAr : d.titleEn,
    [decisionHeaders[1]!]: d.severity,
    [decisionHeaders[2]!]: d.confidence,
    [decisionHeaders[3]!]: isAr ? d.executiveSummaryAr : d.executiveSummaryEn,
    [decisionHeaders[4]!]: isAr ? d.expectedOutcomeAr : d.expectedOutcomeEn,
  }));

  const { html: decisionsTable } = buildGenericTableHtml({
    headers: decisionHeaders,
    rows: decisionRows,
    isAr,
    orientation: "landscape",
  });

  const decisionsSection = `<section class="page-section page-section--flow">
<h2 class="ep-h2">${escapeHtml(isAr ? "سجل القرارات التنفيذية" : "Executive decision register")}</h2>
<div class="ep-table-wrap">${decisionsTable}</div>
</section>`;

  const bodyHtml = `${kpi}${boardSummaryHtml}${sectionBlocks}${decisionsSection}`;

  return buildExecutiveLandscapePageShell({
    isAr,
    documentTitle: title,
    header: {
      isAr,
      competitionName: title,
      reportTypeLabel: isAr ? "قرارات تنفيذية — ذكاء المسابقات" : "Executive decisions — competition intelligence",
      generatedAt,
      headerBannerPath: headerImagePath,
    },
    bodyHtml,
    extraStyles: `${executivePdfTableStyles(isAr)}\n${executiveKpiPanelStyles()}`,
  });
};

/** @deprecated Body-only fragment — use buildExecutiveDecisionPdfDocument */
export const buildExecutiveDecisionPdfHtml = (
  result: AiDecisionEngineResult,
  isAr: boolean
): string => {
  const doc = buildExecutiveDecisionPdfDocument(result, isAr ? "قرارات تنفيذية" : "Executive decisions", isAr);
  const match = doc.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match?.[1] ?? doc;
};
