import { describe, expect, it, vi } from "vitest";
import {
  TRAINING_OUTCOME_TIMELINE_ACTIONS,
  TRAINING_OUTCOME_AUDIT_ACTIONS,
  TRAINING_OUTCOME_LEVELS,
} from "@/lib/partnerships/training-outcome-constants";
import {
  computeEmployabilityScore,
  computeInstitutionEvaluationScore,
  employabilityBandForScore,
} from "@/lib/partnerships/training-employability-scoring";
import {
  computeTrainingReadinessScore,
  deriveOutcomeLevel,
} from "@/lib/partnerships/training-readiness-scoring";
import { deriveTrainingRecognitions } from "@/lib/partnerships/training-outcome-recognition";
import { timelineActionLabel } from "@/lib/partnerships/partnerships-application-workflow";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

describe("training employability scoring", () => {
  it("computes score 0–100 from institution dimensions", () => {
    const score = computeEmployabilityScore({
      institutionEvaluationAverage: 4,
      attendanceScore: 5,
      professionalismScore: 4,
      communicationScore: 4,
      teamworkScore: 4,
      initiativeScore: 4,
      workQualityScore: 4,
      safetyComplianceScore: 5,
    });
    expect(score).toBeGreaterThanOrEqual(70);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("maps employability bands per spec", () => {
    expect(employabilityBandForScore(95)).toBe("excellent");
    expect(employabilityBandForScore(85)).toBe("veryGood");
    expect(employabilityBandForScore(75)).toBe("good");
    expect(employabilityBandForScore(65)).toBe("acceptable");
    expect(employabilityBandForScore(50)).toBe("needsDevelopment");
  });

  it("converts institution rubric average to 0–100", () => {
    expect(computeInstitutionEvaluationScore([5, 5, 5, 5])).toBe(100);
    expect(computeInstitutionEvaluationScore([1, 1, 1, 1])).toBe(0);
  });
});

describe("training readiness scoring", () => {
  it("computes training program readiness separately", () => {
    const score = computeTrainingReadinessScore({
      completedTrainingCount: 2,
      totalTrainingHours: 120,
      avgInstitutionEvaluationScore: 80,
      avgStudentSatisfaction: 8,
      institutionRecommendationRate: 100,
      employmentRecommendationRate: 50,
      passedTrainingRate: 100,
    });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("derives outcome levels deterministically", () => {
    expect(
      deriveOutcomeLevel({ employabilityScore: 92, readinessScore: 88, passedTraining: true })
    ).toBe("excellent");
    expect(
      deriveOutcomeLevel({ employabilityScore: 50, readinessScore: 50, passedTraining: false })
    ).toBe("needs_improvement");
  });
});

describe("training outcome recognition rules", () => {
  it("generates informational recognitions without achievements", () => {
    const recognitions = deriveTrainingRecognitions({
      employabilityScore: 92,
      institutionEvaluationScore: 90,
      professionalismScore: 5,
      safetyComplianceScore: 5,
      passedTraining: true,
      recommendedForEmployment: true,
      outcomeLevel: "excellent",
    });
    expect(recognitions).toContain("outstanding_trainee");
    expect(recognitions).toContain("high_potential_candidate");
    expect(recognitions).toContain("top_training_performer");
  });
});

describe("training outcome — models & extension points", () => {
  it("exports TrainingOutcomeRecord model with required fields", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/models/TrainingOutcomeRecord.ts", "utf8");
    expect(src).toContain("employabilityScore");
    expect(src).toContain("readinessScore");
    expect(src).toContain("outcomeLevel");
    expect(src).toContain("recommendedForEmployment");
  });

  it("exports InstitutionTalentRecommendation model", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/models/InstitutionTalentRecommendation.ts", "utf8");
    expect(src).toContain("recommendationLevel");
    expect(src).toContain("supervisorComment");
  });

  it("hooks outcome creation on final evaluation approval", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/partnerships/training-final-evaluation-supervisor-service.ts", "utf8");
    expect(src).toContain("emitTrainingOutcomeOnFinalApproval");
    expect(src).not.toContain("student-career-profile-service");
  });

  it("does not modify Career Engine internals", async () => {
    const fs = await import("node:fs/promises");
    const careerSrc = await fs.readFile("src/lib/career/student-career-profile-service.ts", "utf8");
    expect(careerSrc).not.toContain("TrainingOutcomeRecord");
  });

  it("extends partnership intelligence additively", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/partnerships/institution-performance-intelligence-service.ts", "utf8");
    expect(src).toContain("trainingOutcomeAnalytics");
    expect(src).toContain("buildPartnershipTrainingOutcomeExtension");
  });

  it("extends school intelligence read-only indices", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/school-intelligence/school-intelligence-service.ts", "utf8");
    expect(src).toContain("trainingOutcomeIndices");
    expect(src).toContain("buildTrainingSchoolIntelligenceIndices");
  });
});

describe("training outcome — timeline & audit", () => {
  it("defines timeline actions", () => {
    expect(TRAINING_OUTCOME_TIMELINE_ACTIONS.outcomeCreated).toBe("training_outcome_created");
    expect(TRAINING_OUTCOME_TIMELINE_ACTIONS.employabilityGenerated).toBe("employability_score_generated");
    expect(TRAINING_OUTCOME_TIMELINE_ACTIONS.readinessCalculated).toBe("training_readiness_calculated");
    expect(TRAINING_OUTCOME_TIMELINE_ACTIONS.recommendationCreated).toBe("institution_recommendation_created");
  });

  it("defines audit actions", () => {
    expect(TRAINING_OUTCOME_AUDIT_ACTIONS.recordCreated).toBe("training_outcome_record_created");
    expect(TRAINING_OUTCOME_AUDIT_ACTIONS.employabilityGenerated).toBe("training_employability_generated");
    expect(TRAINING_OUTCOME_AUDIT_ACTIONS.recommendationGenerated).toBe("training_recommendation_generated");
  });

  it("includes timeline labels", () => {
    expect(timelineActionLabel(TRAINING_OUTCOME_TIMELINE_ACTIONS.outcomeCreated, true)).toContain("نتيجة");
    expect(timelineActionLabel(TRAINING_OUTCOME_TIMELINE_ACTIONS.employabilityGenerated, false)).toContain("Employability");
  });
});

describe("training outcome — UI & API surfaces", () => {
  it("exposes training portfolio page", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/(app)/portfolio/training/page.tsx", "utf8");
    expect(src).toContain("/api/user/training-portfolio");
    expect(src).toContain("Export PDF");
  });

  it("exposes graduate readiness widget without career engine change", async () => {
    const fs = await import("node:fs/promises");
    const widget = await fs.readFile("src/components/career/GraduateReadinessWidget.tsx", "utf8");
    const page = await fs.readFile("src/app/(app)/career-profile/page.tsx", "utf8");
    expect(widget).toContain("جاهزية سوق العمل");
    expect(widget).toContain("/api/user/training-readiness");
    expect(page).toContain("GraduateReadinessWidget");
  });

  it("defines all outcome levels", () => {
    expect(TRAINING_OUTCOME_LEVELS).toEqual([
      "excellent",
      "very_good",
      "good",
      "satisfactory",
      "needs_improvement",
    ]);
  });
});

describe("training outcome analytics", () => {
  it("exports analytics builder", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/partnerships/training-outcome-analytics.ts", "utf8");
    expect(src).toContain("buildTrainingOutcomeAnalytics");
    expect(src).toContain("buildPartnershipTrainingOutcomeExtension");
  });
});
