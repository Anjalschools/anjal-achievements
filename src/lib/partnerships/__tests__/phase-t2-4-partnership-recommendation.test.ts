import { describe, expect, it } from "vitest";
import {
  trainingOutcomeLevelForScore,
  trainingOutcomeLabel,
} from "@/lib/partnerships/partnership-recommendation-constants";
import { predictPartnershipEarlyRisk } from "@/lib/partnerships/partnership-early-risk-prediction";
import { computePartnerReliabilityIndex } from "@/lib/partnerships/partner-reliability-index";
import {
  buildAnnualPartnershipReportExcelRows,
  buildAnnualPartnershipReportPdfHtml,
} from "@/lib/partnerships/partnership-annual-report-service";
import { computeTrainingOutcomeIntelligence } from "@/lib/partnerships/training-outcome-intelligence";
import {
  computeTrainingOpportunityMatchScore,
  rankOpportunityMatches,
} from "@/lib/partnerships/training-opportunity-matching";

describe("phase T.2.4 — partnership recommendation engine", () => {
  it("computes trainingOpportunityMatchScore from student profile signals", () => {
    const result = computeTrainingOpportunityMatchScore(
      {
        careerInterests: ["تقنية", "برمجة"],
        targetMajors: ["علوم الحاسب"],
        achievementCategories: ["technology", "national"],
        priorTrainingCategories: ["technology"],
        grade: "12",
        section: "A",
      },
      {
        opportunityId: "opp-1",
        title: "تدريب تقني في تطوير البرمجيات",
        description: "برمجة وتقنية",
        organizationId: "org-1",
        organizationName: "شركة تقنية",
        organizationCategory: "technology",
        organizationSector: "تقنية",
        qualityIndex: 82,
        reliabilityIndex: 76,
      }
    );

    expect(result.trainingOpportunityMatchScore).toBeGreaterThanOrEqual(50);
    expect(result.trainingOpportunityMatchScore).toBeLessThanOrEqual(100);
    expect(result.reasonAr).toContain("شركة تقنية");
  });

  it("ranks opportunities by match score descending", () => {
    const ranked = rankOpportunityMatches(
      {
        careerInterests: ["صحة"],
        targetMajors: ["طب"],
        achievementCategories: ["health"],
        priorTrainingCategories: [],
      },
      [
        {
          opportunityId: "a",
          title: "تدريب إداري",
          organizationId: "1",
          organizationName: "أمانة",
          organizationCategory: "administrative",
        },
        {
          opportunityId: "b",
          title: "تدريب صحي",
          organizationId: "2",
          organizationName: "مستشفى",
          organizationCategory: "health",
        },
      ]
    );

    expect(ranked[0]?.organizationName).toBe("مستشفى");
    expect(ranked[0]!.trainingOpportunityMatchScore).toBeGreaterThanOrEqual(
      ranked[1]!.trainingOpportunityMatchScore
    );
  });

  it("derives trainingOutcomeLevel bands", () => {
    const exceptional = computeTrainingOutcomeIntelligence({
      studentSatisfaction: 5,
      institutionEvaluation: 5,
      consistencyScore: 92,
      recommendationRatePct: 95,
    });
    expect(exceptional.trainingOutcomeLevel).toBe("exceptional");
    expect(trainingOutcomeLabel("exceptional", true)).toBe("استثنائي");

    const low = computeTrainingOutcomeIntelligence({
      studentSatisfaction: 2,
      institutionEvaluation: 2,
      consistencyScore: 30,
      recommendationRatePct: 10,
    });
    expect(trainingOutcomeLevelForScore(low.outcomeScore)).toBe("low");
  });

  it("computes partnerReliabilityIndex from operational factors", () => {
    const result = computePartnerReliabilityIndex({
      reportCompletionRatePct: 90,
      averageResponseDays: 2,
      approvalCompletionRatePct: 85,
      studentRecommendationRatePct: 80,
      supervisorApprovalRatePct: 88,
    });

    expect(result.partnerReliabilityIndex).toBeGreaterThanOrEqual(75);
    expect(result.partnerReliabilityIndex).toBeLessThanOrEqual(100);
  });

  it("predicts early risk flags before training completion", () => {
    const risk = predictPartnershipEarlyRisk({
      applicationStatus: "in_training",
      organizationQualityIndex: 40,
      partnerReliabilityIndex: 35,
      matchScore: 42,
      messageCount: 0,
      daysSinceAccepted: 14,
      parentConsentComplete: false,
      documentsComplete: false,
    });

    expect(risk.riskFlags).toContain("LOW_SUCCESS_RISK");
    expect(risk.riskFlags).toContain("LOW_ENGAGEMENT_RISK");
    expect(risk.riskFlags).toContain("DOCUMENT_COMPLETION_RISK");
  });

  it("builds annual report export payloads", () => {
    const report = {
      generatedAt: new Date().toISOString(),
      academicYearLabel: "2025/2026",
      topOrganizations: [
        { organizationName: "جامعة الملك فيصل", combinedScore: 89, recommendationRatePct: 82 },
      ],
      successTrends: [{ label: "qualityIndex", value: 78 }],
      studentSatisfactionTrends: [{ label: "2025/2026", average: 4.2 }],
      completionTrends: [{ label: "2025/2026", ratePct: 88 }],
      recommendationTrends: [{ label: "2025/2026", ratePct: 76 }],
    };

    const excel = buildAnnualPartnershipReportExcelRows(report);
    expect(excel.orgRows).toHaveLength(1);
    expect(excel.trendRows.length).toBeGreaterThan(0);

    const html = buildAnnualPartnershipReportPdfHtml(report);
    expect(html).toContain("تقرير ذكاء الشراكات السنوي");
    expect(html).toContain("جامعة الملك فيصل");
  });
});
