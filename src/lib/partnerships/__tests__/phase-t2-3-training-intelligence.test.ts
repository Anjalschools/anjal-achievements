import { describe, expect, it } from "vitest";
import { trainingQualityLabelForScore } from "@/lib/partnerships/training-intelligence-constants";
import {
  analyzeTrainingReportConsistency,
  computeTextSimilarityPct,
} from "@/lib/partnerships/training-report-consistency";
import { computeOrganizationTrainingQualityIndex } from "@/lib/partnerships/training-organization-quality-index";

describe("phase T.2.3 — training intelligence & consistency", () => {
  it("scores high consistency when student and institution reports align", () => {
    const result = analyzeTrainingReportConsistency({
      volunteerHours: 120,
      positionTitle: "مساعد إداري",
      practicalBenefitRating: 4,
      supervisorCooperationRating: 5,
      workEnvironmentRating: 4,
      recommendInstitutionToPeers: true,
      overallRecommendation: 5,
      assignedTasks: "أرشفة الملفات ومتابعة المراسلات",
      studentReflection: "تعلمت تنظيم العمل والتواصل المهني",
      institutionUploadedEvaluation: {
        positionTitle: "مساعد إداري",
        technicalSkillsRating: 4,
        taskExecutionRating: 4,
        problemSolvingRating: 4,
        communicationRating: 5,
        disciplineRating: 5,
        teamworkRating: 4,
        initiativeRating: 4,
        assignedTasks: "أرشفة الملفات ومتابعة المراسلات اليومية",
      },
    });

    expect(result.consistencyScore).toBeGreaterThanOrEqual(75);
    expect(result.riskFlags).not.toContain("LOW_CONSISTENCY");
  });

  it("flags rating and hours mismatches", () => {
    const result = analyzeTrainingReportConsistency({
      volunteerHours: 200,
      practicalBenefitRating: 5,
      supervisorCooperationRating: 5,
      workEnvironmentRating: 5,
      recommendInstitutionToPeers: false,
      overallRecommendation: 2,
      institutionNotes: "أتم المتدرب 120 ساعة تدريبية",
      institutionUploadedEvaluation: {
        technicalSkillsRating: 2,
        communicationRating: 2,
        disciplineRating: 2,
        teamworkRating: 2,
        initiativeRating: 2,
      },
    });

    expect(result.riskFlags).toContain("RATING_MISMATCH");
    expect(result.riskFlags).toContain("HOURS_MISMATCH");
    expect(result.consistencyScore).toBeLessThan(60);
    expect(result.riskFlags).toContain("LOW_CONSISTENCY");
  });

  it("detects high narrative similarity", () => {
    const repeated =
      "قمت بأرشفة الملفات ومتابعة المراسلات وإعداد التقارير اليومية مع فريق العمل";
    const result = analyzeTrainingReportConsistency({
      assignedTasks: repeated,
      studentReflection: repeated,
      institutionUploadedEvaluation: {
        assignedTasks: repeated,
        achievements: repeated,
      },
    });

    expect(result.maxNarrativeSimilarityPct).toBeGreaterThanOrEqual(75);
    expect(result.riskFlags).toContain("HIGH_TEXT_SIMILARITY");
  });

  it("computes text similarity deterministically", () => {
    expect(computeTextSimilarityPct("hello world test", "hello world sample")).toBeGreaterThan(0);
    expect(computeTextSimilarityPct("", "hello")).toBe(0);
  });

  it("computes organization training quality index", () => {
    const metrics = computeOrganizationTrainingQualityIndex([
      {
        status: "approved",
        studentBenefitRating: 5,
        practicalBenefitRating: 4,
        supervisorCooperationRating: 5,
        workEnvironmentRating: 4,
        recommendInstitutionToPeers: true,
        overallRecommendation: 5,
        attendanceCommitment: 5,
        professionalEthics: 5,
        safetyCompliance: 5,
      },
      {
        status: "submitted",
        studentBenefitRating: 3,
        practicalBenefitRating: 3,
        supervisorCooperationRating: 3,
        workEnvironmentRating: 3,
        recommendInstitutionToPeers: false,
        overallRecommendation: 3,
        attendanceCommitment: 3,
      },
    ]);

    expect(metrics.organizationTrainingQualityIndex).toBeGreaterThan(0);
    expect(metrics.reportCount).toBe(2);
    expect(trainingQualityLabelForScore(metrics.organizationTrainingQualityIndex, true)).toBeTruthy();
  });
});
