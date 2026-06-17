import { describe, expect, it } from "vitest";
import {
  APPROVED_TRAINING_PLACEMENT_STATUSES,
  INSTITUTION_ASSESSMENT_CATEGORIES,
  INSTITUTION_ASSESSMENT_DIMENSIONS,
  isApprovedTrainingPlacement,
  expandInstitutionAssessmentPayload,
  MAX_TRAINING_EVIDENCE_IMAGES,
  STUDENT_EXPERIENCE_RATING_LABELS,
  INSTITUTION_RATING_LABELS,
  computeOpportunityRequiredTrainingHours,
  getTrainingHoursMaxAllowed,
  TRAINING_HOURS_TOLERANCE,
} from "@/lib/partnerships/training-final-evaluation-ui-constants";

describe("training final evaluation UI constants", () => {
  it("defines approved placement statuses", () => {
    expect(APPROVED_TRAINING_PLACEMENT_STATUSES).toContain("accepted");
    expect(APPROVED_TRAINING_PLACEMENT_STATUSES).toContain("final_evaluation_approved");
    expect(isApprovedTrainingPlacement("accepted")).toBe(true);
    expect(isApprovedTrainingPlacement("rejected")).toBe(false);
    expect(isApprovedTrainingPlacement("in_training")).toBe(true);
  });

  it("defines 10 institution assessment dimensions", () => {
    expect(INSTITUTION_ASSESSMENT_DIMENSIONS).toHaveLength(10);
    expect(INSTITUTION_ASSESSMENT_DIMENSIONS.map((d) => d.key)).toContain("safetyComplianceScore");
    expect(INSTITUTION_ASSESSMENT_DIMENSIONS.map((d) => d.key)).toContain("taskExecutionScore");
  });

  it("maps workEthicsScore to PDF discipline dimension", () => {
    const expanded = expandInstitutionAssessmentPayload(
      {
        attendanceScore: 5,
        workEthicsScore: 2,
        communicationScore: 4,
        teamworkScore: 4,
        learningSpeedScore: 4,
        taskExecutionScore: 5,
        professionalismScore: 5,
        initiativeScore: 4,
        workQualityScore: 4,
        safetyComplianceScore: 5,
      },
      "recommended"
    );
    expect(expanded.attendanceScore).toBe(5);
    expect(expanded.workEthicsScore).toBe(2);
    expect(expanded.punctualityScore).toBe(5);
  });

  it("parses institution strengths into achievements and strengths", async () => {
    const { parseInstitutionStrengthsFields } = await import(
      "@/lib/partnerships/training-final-evaluation-ui-constants"
    );
    const parsed = parseInstitutionStrengthsFields(
      "أبرز الإنجازات:\nإنجاز أ\n\nنقاط القوة:\nقوة ب"
    );
    expect(parsed.topAchievements).toContain("إنجاز");
    expect(parsed.strengths).toContain("قوة");
  });

  it("defines institution assessment categories", () => {
    expect(INSTITUTION_ASSESSMENT_CATEGORIES).toHaveLength(4);
  });

  it("computes opportunity required training hours", () => {
    const required = computeOpportunityRequiredTrainingHours("2026-01-01", "2026-01-15");
    expect(required).toBeGreaterThan(0);
    expect(getTrainingHoursMaxAllowed(required)).toBe(required + TRAINING_HOURS_TOLERANCE);
  });

  it("student final evaluation page uses SurveyExperienceCard and preview", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/(app)/summer-training/[id]/final-evaluation/page.tsx", "utf8");
    expect(src).toContain("SurveyExperienceCard");
    expect(src).toContain("مدى استفادتي من التدريب");
    expect(src).toContain("preview-report");
    expect(src).toContain("معاينة التقرير النهائي");
  });

  it("institution final panel groups categories and validates hours", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/institution/InstitutionFinalEvaluationPanel.tsx", "utf8");
    expect(src).toContain("INSTITUTION_ASSESSMENT_CATEGORIES");
    expect(src).toContain("recommendationReason");
    expect(src).toContain("hoursOverrideConfirmed");
  });

  it("student institution summary shown after approval", async () => {
    const fs = await import("node:fs/promises");
    const reportPage = await fs.readFile("src/app/(app)/summer-training/[id]/final-report/page.tsx", "utf8");
    const apiRoute = await fs.readFile("src/app/api/partnerships/applications/[id]/final-report/route.ts", "utf8");
    expect(reportPage).toContain("StudentInstitutionEvaluationSummary");
    expect(reportPage).toContain("institutionEvaluationVisible");
    expect(apiRoute).toContain("institutionEvaluationVisible");
    expect(apiRoute).toContain("supervisorApproved");
  });

  it("admin review summary component exists", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/(app)/admin/partnerships/final-evaluations/[id]/page.tsx", "utf8");
    expect(src).toContain("FinalEvaluationReviewSummary");
  });

  it("training gallery supports labels and main preview", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/partnerships/TrainingEvidenceGallery.tsx", "utf8");
    expect(src).toContain("TRAINING_EVIDENCE_IMAGE_LABELS");
    expect(src).toContain("caption");
    expect(src).toContain("Full screen");
  });

  it("maps simplified institution scores to full API payload", () => {
    const expanded = expandInstitutionAssessmentPayload(
      {
        attendanceScore: 5,
        workEthicsScore: 4,
        communicationScore: 4,
        teamworkScore: 4,
        learningSpeedScore: 4,
        taskExecutionScore: 5,
        professionalismScore: 5,
        initiativeScore: 4,
        workQualityScore: 4,
        safetyComplianceScore: 5,
      },
      "strongly_recommended"
    );
    expect(expanded.attendanceScore).toBe(5);
    expect(expanded.safetyComplianceScore).toBe(5);
    expect(expanded.recommendEmployment).toBe(true);
    expect(expanded.passedTraining).toBe(true);
  });

  it("limits training evidence images to 8", () => {
    expect(MAX_TRAINING_EVIDENCE_IMAGES).toBe(8);
  });

  it("defines separate student and institution rating labels", () => {
    expect(STUDENT_EXPERIENCE_RATING_LABELS).toHaveLength(5);
    expect(INSTITUTION_RATING_LABELS).toHaveLength(5);
    expect(STUDENT_EXPERIENCE_RATING_LABELS[0].ar).toContain("ضعيف");
  });
});

describe("final evaluation UX surfaces", () => {
  it("exports shared SurveyRatingControl with card radiogroup", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/survey/SurveyRatingControl.tsx", "utf8");
    expect(src).toContain("STUDENT_EXPERIENCE_RATING_LABELS");
    expect(src).toContain("INSTITUTION_RATING_LABELS");
    expect(src).toContain('role="radiogroup"');
    expect(src).not.toContain("<select");
  });

  it("student final evaluation page is student-only with five sections", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/(app)/summer-training/[id]/final-evaluation/page.tsx", "utf8");
    expect(src).toContain("تقييمي للتجربة التدريبية");
    expect(src).toContain("TrainingEvidenceGallery");
    expect(src).toContain('labelSet="student"');
    expect(src).not.toContain("attendanceScore");
    expect(src).not.toContain("institutionNotes");
    expect(src).not.toContain("supervisorName");
  });

  it("legacy student final report page hides institution dimensions", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/(app)/summer-training/final-report/page.tsx", "utf8");
    expect(src).not.toContain("تقييم المؤسسة للطالب");
    expect(src).not.toContain("institutionNotes");
    expect(src).not.toContain("attendanceCommitment");
    expect(src).toContain("SurveyRatingControl");
    expect(src).toContain('labelSet="student"');
  });

  it("highlights approved placement on summer training list", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/(app)/summer-training/page.tsx", "utf8");
    expect(src).toContain("ApprovedPlacementBadge");
    expect(src).toContain("isApprovedTrainingPlacement");
    expect(src).toContain("approvedPlacementCardClass");
  });

  it("institution evaluation center is periodic-only", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/institution/InstitutionEvaluationCenter.tsx", "utf8");
    expect(src).toContain("التقييمات الدورية");
    expect(src).not.toContain("InstitutionFinalEvaluationPanel");
  });

  it("institution final panel has ten dimensions and report fields", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/institution/InstitutionFinalEvaluationPanel.tsx", "utf8");
    expect(src).toContain("INSTITUTION_ASSESSMENT_DIMENSIONS");
    expect(src).toContain("supervisorPhone");
    expect(src).toContain("topAchievements");
    expect(src).toContain('labelSet="institution"');
  });

  it("pdf generator maps discipline to workEthics and includes supervisorPhone", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/partnerships/training-final-report-pdf-generator.ts", "utf8");
    expect(src).toContain("scoreLabel(s.workEthics)");
    expect(src).not.toMatch(/الانضباط المهني.*s\.punctuality/);
    expect(src).toContain("رقم التواصل");
    expect(src).toContain("أبرز الإنجازات");
    expect(src).toContain("تقييم الطالب للتجربة التدريبية");
    expect(src).toContain("تقييم المؤسسة للطالب");
    expect(src).toContain("institutionSectionComplete");
  });

  it("does not modify career or outcome engines", async () => {
    const fs = await import("node:fs/promises");
    const career = await fs.readFile("src/lib/career/student-career-profile-service.ts", "utf8");
    const outcome = await fs.readFile("src/lib/partnerships/training-outcome-service.ts", "utf8");
    expect(career).not.toContain("SurveyRatingControl");
    expect(outcome).not.toContain("SurveyRatingControl");
  });
});
