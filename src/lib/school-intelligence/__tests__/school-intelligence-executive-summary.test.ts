import { describe, expect, it } from "vitest";
import { buildSchoolIntelligenceExecutiveSummary } from "@/lib/school-intelligence/school-intelligence-executive-summary";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";

const samplePayload = (): SchoolIntelligencePayload =>
  ({
    generatedAt: new Date().toISOString(),
    schoolExcellence: {
      excellenceIndex: 72,
      avgStudentSuccessIndex: 24,
      totalStudents: 500,
      activeParticipants: 120,
      participationRatePct: 24,
      yearOverYearGrowthPct: 8,
      evidence: "",
    },
    studentSuccessGraph: { totalNodes: 120, avgSuccessIndex: 24, topStudents: [] },
    strategicInsights: [
      {
        id: "1",
        titleAr: "t",
        titleEn: "t",
        bodyAr: "توصية",
        bodyEn: "Recommendation",
        descriptionAr: "توصية",
        descriptionEn: "Recommendation",
        severity: "info",
        insightType: "test",
        category: "opportunity",
        confidence: 82,
        evidence: [],
      },
    ],
    departmentExcellence: [
      {
        key: "d1",
        dimension: "department",
        labelAr: "علوم",
        labelEn: "Science",
        studentCount: 20,
        avgSuccessIndex: 60,
        avgParticipation: 3,
        growthRatePct: 5,
        excellenceIndex: 68,
        evidence: "",
      },
    ],
    longitudinalGrowth: [{ year: 2024, participations: 100, students: 80, avgSuccessIndex: 22, growthRatePct: 5 }],
    growthTrends: {
      highlights: [
        {
          id: "participation-growth",
          titleAr: "نمو",
          titleEn: "Growth",
          bodyAr: "ارتفعت المشاركات",
          bodyEn: "Participations rose",
          metricKey: "participation",
          changePct: 12,
          confidence: 80,
        },
      ],
      participationTrajectory: "rising",
      forecastSignalAr: "إشارة إيجابية",
      forecastSignalEn: "Positive signal",
      summaryAr: "اتجاه صاعد",
      summaryEn: "Rising trend",
    },
    talentDiscovery: [],
    interventions: [
      {
        studentId: "1",
        fullName: "S",
        interventionType: "activity_decline",
        severity: "medium",
        detailAr: "d",
        detailEn: "d",
        evidence: [],
      },
    ],
    opportunityMapping: [
      {
        key: "opp1",
        dimension: "activity",
        labelAr: "مسابقة",
        labelEn: "Competition",
        opportunityCount: 2,
        participantCount: 40,
        gapPct: 18,
        confidence: 75,
        recommendationAr: "r",
        recommendationEn: "r",
      },
    ],
    governance: { readOnly: true, explainable: true, deterministic: true, dataSources: [] },
  }) as SchoolIntelligencePayload;

describe("school-intelligence-executive-summary", () => {
  it("generates bounded executive summary categories", () => {
    const summary = buildSchoolIntelligenceExecutiveSummary({
      intelligence: samplePayload(),
      readiness: {
        version: "10.3.3.D.14",
        availableSections: 7,
        unavailableSections: 0,
        noDataSections: 1,
        healthScore: 84,
        intelligenceScore: 96,
        snapshotStatus: "healthy",
        diagnosticsStatus: "healthy",
        buildStatus: "success",
        testStatus: "79/79 passing",
        finalReadiness: "PRODUCTION_READY",
        certificationStatus: "CERTIFIED_PRODUCTION_READY",
      },
    });

    expect(summary.strengths.length).toBeGreaterThan(0);
    expect(summary.strengths.length).toBeLessThanOrEqual(5);
    expect(summary.risks.length).toBeLessThanOrEqual(5);
    expect(summary.opportunities.length).toBeLessThanOrEqual(5);
    expect(summary.recommendations.length).toBeLessThanOrEqual(5);
    expect(summary.growthTrends.length).toBeGreaterThan(0);
    expect(summary.strengths[0]?.confidence).toBeGreaterThan(0);
  });
});
