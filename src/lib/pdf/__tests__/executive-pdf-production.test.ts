import { describe, expect, it } from "vitest";
import { balanceRowChunks, chunkRowsByPrintableHeight } from "@/lib/pdf/executive-pdf-pagination";
import { buildExecutiveGenericTableExportHtml } from "@/lib/pdf/executive-pdf-generic-export";
import { buildExecutiveDecisionPdfDocument } from "@/lib/analytics/ai/executive-decision-pdf-layout";
import type { AiDecisionEngineResult } from "@/lib/analytics/ai/ai-decision-schema";
import { EXECUTIVE_PDF_MARGINS, EXECUTIVE_PDF_PALETTE } from "@/lib/pdf/executive-pdf-theme";

describe("executive PDF production hardening", () => {
  it("balances sparse last chunks", () => {
    const chunks: number[][] = [
      Array.from({ length: 40 }, (_, i) => i),
      [99],
    ];
    const balanced = balanceRowChunks(chunks, 3);
    expect(balanced[balanced.length - 1]!.length).toBeGreaterThan(1);
  });

  it("chunks rows with printable height budget", () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({ id: i }));
    const chunks = chunkRowsByPrintableHeight({
      rows,
      orientation: "landscape",
      firstPageOverheadMm: 72,
      continuationOverheadMm: 28,
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat().length).toBe(120);
  });

  it("emits unified landscape shell and theme tokens for generic export", () => {
    const { html } = buildExecutiveGenericTableExportHtml({
      isAr: true,
      title: "تقرير اختبار",
      headers: ["الاسم", "السنة"],
      rows: [{ الاسم: "طالب", السنة: "2024" }],
      orientation: "landscape",
      summaryLines: ["ملخص"],
    });
    expect(html).toContain("ep-official-header");
    expect(html).toContain("report-header.png");
    expect(html).toContain("ep-grid");
    expect(html).toContain("ep-landscape-stage");
    expect(html).not.toContain("ep-landscape-stage--center");
    expect(html).toContain(EXECUTIVE_PDF_PALETTE.primaryNavy);
    expect(html).toContain(`${EXECUTIVE_PDF_MARGINS.topMm}mm`);
    expect(html).not.toContain("html2canvas");
    expect(html).not.toContain("ep-school-ar");
    expect(html).not.toContain("ep-platform");
  });

  it("repeats official banner on continuation pages", () => {
    const rows = Array.from({ length: 80 }, (_, i) => ({
      الاسم: `طالب ${i}`,
      السنة: "2024",
    }));
    const { html, pageCount } = buildExecutiveGenericTableExportHtml({
      isAr: true,
      title: "إحصائيات ونتائج المسابقات",
      headers: ["الاسم", "السنة"],
      rows,
      orientation: "landscape",
      summaryLines: ["ملخص المسابقة التنفيذي"],
    });
    expect(pageCount).toBeGreaterThan(1);
    const bannerCount = (html.match(/data-official-report-header="1"/g) ?? []).length;
    expect(bannerCount).toBe(pageCount);
    expect(html).toContain("ep-official-header--continuation");
    expect(html).toContain("ep-footer");
  });

  it("builds executive decisions on unified document", () => {
    const stub: AiDecisionEngineResult = {
      bundle: {
        generatedAt: new Date().toISOString(),
        filterFingerprint: "x",
        decisions: [],
        topPriorities: [],
        criticalRisks: [],
        highImpactOpportunities: [],
        recommendedActions: [],
        hasData: true,
      },
      actionPlan: {
        immediate: [],
        shortTerm: [],
        mediumTerm: [],
        longTerm: [],
        roadmap: [],
      },
      boardSummary: {
        headlineAr: "عنوان",
        headlineEn: "Headline",
        topPriorityAr: "أولوية",
        topPriorityEn: "Priority",
        greatestRiskAr: "خطر",
        greatestRiskEn: "Risk",
        bestInvestmentAr: "استثمار",
        bestInvestmentEn: "Investment",
        resourceFocusAr: "موارد",
        resourceFocusEn: "Resources",
      },
    };
    const html = buildExecutiveDecisionPdfDocument(stub, "قرارات", true);
    expect(html).toContain("ep-kpi-grid");
    expect(html).toContain("ep-footer");
    expect(html).toContain("تقرير تنفيذي");
  });
});
