import { describe, expect, it } from "vitest";
import {
  EXECUTIVE_EXPORT_REGISTRY,
  EXECUTIVE_REPORT_IDS,
  getExecutiveReportDefinition,
} from "@/lib/pdf/executive-export-registry";
import {
  validateExecutivePdfExportContract,
} from "@/lib/pdf/contracts/executive-pdf-export-contract";
import { validateExecutivePdfTableContract } from "@/lib/pdf/contracts/executive-pdf-table-contract";
import { schemaFromHeaders } from "@/lib/pdf/schema/executive-table-schema";
import { buildExecutiveGenericTableExportHtml } from "@/lib/pdf/executive-pdf-generic-export";
import {
  executivePdfStructureFingerprint,
  normalizeExecutivePdfHtmlForSnapshot,
} from "@/lib/pdf/governance/executive-visual-snapshot";
import { assessDatasetForExport } from "@/lib/pdf/governance/executive-pdf-dataset-guard";
import { buildGovernedExecutiveReport } from "@/lib/pdf/executive-pdf-governance";
import { buildExecutiveDecisionPdfDocument } from "@/lib/analytics/ai/executive-decision-pdf-layout";
import type { AiDecisionEngineResult } from "@/lib/analytics/ai/ai-decision-schema";

describe("executive export registry", () => {
  it("registers all report ids with required governance fields", () => {
    for (const id of EXECUTIVE_REPORT_IDS) {
      const def = getExecutiveReportDefinition(id);
      expect(def.id).toBe(id);
      expect(def.pageSize).toBe("A4");
      expect(def.exportBuilder).toBeTypeOf("function");
      expect(EXECUTIVE_EXPORT_REGISTRY[id]).toBe(def);
    }
  });
});

describe("export contracts", () => {
  it("rejects export without title", () => {
    const result = validateExecutivePdfExportContract(
      {
        reportId: "portrait-table",
        title: "",
        isAr: true,
        orientation: "portrait",
        pageSize: "A4",
        layoutMode: "standard",
        rowCount: 1,
        columnCount: 2,
      },
      { minTitleLength: 1 }
    );
    expect(result.ok).toBe(false);
  });

  it("validates table schema contract", () => {
    const schema = schemaFromHeaders("t", ["الاسم", "السنة"], "landscape");
    const v = validateExecutivePdfTableContract({
      schema,
      rowCount: 5,
      orientation: "landscape",
    });
    expect(v.ok).toBe(true);
  });
});

describe("visual regression snapshots (deterministic HTML)", () => {
  it("matches landscape executive structure fingerprint", () => {
    const { html } = buildExecutiveGenericTableExportHtml({
      isAr: true,
      title: "تقرير",
      headers: ["الاسم", "الدرجة"],
      rows: [{ الاسم: "أحمد", الدرجة: "95" }],
      orientation: "landscape",
      summaryLines: ["ملخص"],
    });
    const normalized = normalizeExecutivePdfHtmlForSnapshot(html);
    expect(executivePdfStructureFingerprint(html)).toMatchInlineSnapshot(
      `"ep-official-header|report-header.png|ep-footer|ep-grid|ep-kpi-grid|page-shell|ep-landscape-stage|@page|ep-table-wrap"`
    );
    expect(normalized).toContain("ep-grid");
    expect(normalized).toContain("ep-landscape-stage");
  });

  it("snapshots normalized portrait table shell", () => {
    const { html } = buildExecutiveGenericTableExportHtml({
      isAr: true,
      title: "جدول",
      headers: ["البند"],
      rows: [{ البند: "قيمة" }],
      orientation: "portrait",
    });
    expect(normalizeExecutivePdfHtmlForSnapshot(html)).toMatchSnapshot();
  });
});

describe("dataset guard", () => {
  it("escalates wide portrait tables to landscape", () => {
    const a = assessDatasetForExport({
      rowCount: 100,
      columnCount: 12,
      orientation: "portrait",
    });
    expect(a.escalatedOrientation).toBe("landscape");
    expect(a.warnings).toContain("auto_landscape_escalation");
  });
});

describe("governed build", () => {
  it("builds executive decisions without throwing", async () => {
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
        headlineAr: "ع",
        headlineEn: "H",
        topPriorityAr: "p",
        topPriorityEn: "p",
        greatestRiskAr: "r",
        greatestRiskEn: "r",
        bestInvestmentAr: "i",
        bestInvestmentEn: "i",
        resourceFocusAr: "f",
        resourceFocusEn: "f",
      },
    };
    const built = await buildGovernedExecutiveReport("executive-decisions", {
      result: stub,
      title: "قرارات",
      isAr: true,
    });
    expect(built.html).toContain("ep-kpi-grid");
    expect(built.metrics.rowCount).toBe(0);
  });
});
