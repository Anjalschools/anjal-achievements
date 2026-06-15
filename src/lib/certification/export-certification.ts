import "server-only";
import {
  buildPartnershipExport,
  rowsToCsv,
  type PartnershipExportReport,
} from "@/lib/partnerships/partnerships-export-service";
import { buildExecutiveIntelligenceReportHtml } from "@/lib/analytics/executive-intelligence-export";
import type { ExecutiveDecisionIntelligencePayload } from "@/lib/analytics/executive-decision-intelligence-service";
import type { ExportTestResult } from "@/lib/certification/platform-certification-types";

const buildPdfHtml = (title: string, headers: string[], rows: Array<Record<string, string | number>>) => {
  const escape = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const head = headers.map((h) => `<th>${escape(h)}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${headers.map((h) => `<td>${escape(String(row[h] ?? ""))}</td>`).join("")}</tr>`)
    .join("");
  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"/><title>${escape(title)}</title></head><body><h1>${escape(title)}</h1><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
};

const minimalExecutivePayload = (): ExecutiveDecisionIntelligencePayload => ({
  generatedAt: new Date().toISOString(),
  talentPipeline: {
    byUniversityReadiness: [],
    byCareerReadiness: [],
    byTrainingHours: [],
    byVolunteerHours: [],
    byAnnualGrowth: [],
  },
  risks: [],
  opportunityGaps: [],
  institutionEffectiveness: [],
  competitionRoi: [],
  executiveInsights: [
    {
      id: "cert-smoke-test",
      insightType: "benchmark",
      severity: "info",
      title: "اختبار التصدير",
      titleEn: "Export test",
      body: "Smoke test payload",
      evidence: [{ label: "mode", value: "certification" }],
      recommendation: "لا إجراء مطلوب",
      recommendationEn: "No action required",
      affectedEntity: "platform",
      affectedEntityType: "cohort",
      domain: "certification",
      confidence: "HIGH",
      generatedAt: new Date().toISOString(),
      metadata: {},
    },
  ],
  strategicRecommendations: [],
  predictions: [],
  careerSummary: {
    totalProfiles: 0,
    averages: {
      universityReadiness: 0,
      careerReadiness: 0,
      trainingHours: 0,
      volunteerHours: 0,
      achievementsScore: 0,
      leadershipScore: 0,
      skillsScore: 0,
    },
    careerReadinessBands: { high: 0, medium: 0, developing: 0 },
    universityReadinessBands: { high: 0, medium: 0, developing: 0 },
    topSkills: [],
    topPathways: [],
    partnershipAnalytics: {
      totalOrganizations: 0,
      activeOrganizations: 0,
      ratedOrganizations: 0,
      averageOrganizationRating: 0,
      categoryBreakdown: [],
      insights: {
        bestSatisfaction: null,
        highestAcceptanceRate: null,
        highestCompletionRate: null,
        fastestResponse: null,
        measuredAt: new Date().toISOString(),
      },
      measuredAt: new Date().toISOString(),
    },
    measuredAt: new Date().toISOString(),
  },
  partnershipAnalytics: {
    totalOrganizations: 0,
    activeOrganizations: 0,
    ratedOrganizations: 0,
    averageOrganizationRating: 0,
    categoryBreakdown: [],
    insights: {
      bestSatisfaction: null,
      highestAcceptanceRate: null,
      highestCompletionRate: null,
      fastestResponse: null,
      measuredAt: new Date().toISOString(),
    },
    measuredAt: new Date().toISOString(),
  },
  partnershipIntelligence: {
    generatedAt: new Date().toISOString(),
    academicYearLabel: "certification",
    summary: {
      totalPartnerships: 0,
      activeInstitutions: 0,
      totalTrainees: 0,
      avgQualityScore: 0,
      bestInstitution: null,
      weakestInstitution: null,
    },
    rankings: {
      topRated: [],
      mostActive: [],
      highestAcceptance: [],
      highestRated: [],
      fastestResponse: [],
    },
    alerts: [],
    schoolImprovementIndicators: {
      careerReadiness: 0,
      externalPartnerships: 0,
      professionalExposure: 0,
      studentPlacementSuccess: 0,
    },
    parentConsentAnalytics: {
      required: 0,
      uploaded: 0,
      approved: 0,
      suspiciousCount: 0,
      avgConfidenceScore: 0,
      outdatedDetectedCount: 0,
      regeneratedCount: 0,
      templateCompatibilityRate: 0,
    },
    executiveWidget: {
      partnershipCount: 0,
      activeInstitutions: 0,
      bestInstitutionName: "—",
      weakestInstitutionName: "—",
      traineeCount: 0,
      avgQualityScore: 0,
    },
  },
  governance: { readOnly: true, explainable: true, dataSources: ["certification_smoke_test"] },
});

const runTest = async (
  key: string,
  labelAr: string,
  labelEn: string,
  format: ExportTestResult["format"],
  fn: () => Promise<string | Buffer>
): Promise<ExportTestResult> => {
  const t0 = Date.now();
  try {
    const output = await fn();
    const byteSize = typeof output === "string" ? Buffer.byteLength(output, "utf8") : output.byteLength;
    return {
      key,
      labelAr,
      labelEn,
      format,
      passed: byteSize > 0,
      durationMs: Date.now() - t0,
      byteSize,
    };
  } catch (error) {
    return {
      key,
      labelAr,
      labelEn,
      format,
      passed: false,
      durationMs: Date.now() - t0,
      byteSize: 0,
      error: error instanceof Error ? error.message : "export_failed",
    };
  }
};

export const runExportCertification = async (): Promise<{
  tests: ExportTestResult[];
  passed: number;
  failed: number;
}> => {
  const reports: PartnershipExportReport[] = ["organizations", "trainees", "hours", "approvals"];
  const tests: ExportTestResult[] = [];

  for (const report of reports) {
    tests.push(
      await runTest(
        `partnerships_${report}_csv`,
        `تصدير CSV — ${report}`,
        `CSV export — ${report}`,
        "csv",
        async () => {
          const built = await buildPartnershipExport(report);
          return rowsToCsv(built.headers, built.rows);
        }
      )
    );

    tests.push(
      await runTest(
        `partnerships_${report}_html`,
        `تصدير PDF/HTML — ${report}`,
        `PDF/HTML export — ${report}`,
        "html",
        async () => {
          const built = await buildPartnershipExport(report);
          return buildPdfHtml(built.titleAr, built.headers, built.rows);
        }
      )
    );
  }

  tests.push(
    await runTest("partnerships_xlsx", "تصدير Excel للشراكات", "Partnerships Excel export", "xlsx", async () => {
      const built = await buildPartnershipExport("trainees");
      const XLSX = await import("xlsx");
      const sheetRows = [
        { A: built.titleAr },
        ...built.rows.map((row) =>
          built.headers.reduce<Record<string, string>>((acc, h) => {
            acc[h] = String(row[h] ?? "");
            return acc;
          }, {})
        ),
      ];
      const ws = XLSX.utils.json_to_sheet(sheetRows, { skipHeader: true });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "trainees");
      return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
    })
  );

  const execPayload = minimalExecutivePayload();
  for (const kind of ["executive", "board", "school_improvement"] as const) {
    tests.push(
      await runTest(
        `executive_${kind}_html`,
        `تقرير ${kind}`,
        `${kind} report`,
        "html",
        async () => buildExecutiveIntelligenceReportHtml(execPayload, kind, "ar")
      )
    );
  }

  const passed = tests.filter((t) => t.passed).length;
  return { tests, passed, failed: tests.length - passed };
};
