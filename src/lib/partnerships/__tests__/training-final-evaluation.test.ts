import { describe, expect, it, vi } from "vitest";
import {
  FINAL_EVALUATION_STATUS_TRANSITIONS,
  FINAL_EVALUATION_TIMELINE_ACTIONS,
  canFinalEvaluationTransition,
  isScore1to5,
  isScore1to10,
} from "@/lib/partnerships/training-final-evaluation-constants";
import { timelineActionLabel } from "@/lib/partnerships/partnerships-application-workflow";

vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

describe("final evaluation workflow — additive transitions", () => {
  it("allows completed → awaiting_final_evaluation_review", () => {
    expect(canFinalEvaluationTransition("completed", "awaiting_final_evaluation_review")).toBe(true);
  });

  it("allows review → approved/rejected", () => {
    expect(canFinalEvaluationTransition("awaiting_final_evaluation_review", "final_evaluation_approved")).toBe(true);
    expect(canFinalEvaluationTransition("awaiting_final_evaluation_review", "final_evaluation_rejected")).toBe(true);
  });

  it("does not modify core APPLICATION_STATUS_TRANSITIONS completed exits", async () => {
    const { APPLICATION_STATUS_TRANSITIONS } = await import("@/lib/partnerships/partnerships-state-machine");
    expect(APPLICATION_STATUS_TRANSITIONS.completed).toEqual([]);
  });

  it("defines extension map separately", () => {
    expect(FINAL_EVALUATION_STATUS_TRANSITIONS.completed).toContain("awaiting_final_evaluation_review");
  });
});

describe("final evaluation — timeline labels", () => {
  it("includes all required timeline actions", () => {
    expect(timelineActionLabel(FINAL_EVALUATION_TIMELINE_ACTIONS.studentSubmitted, true)).toContain("تقييم");
    expect(timelineActionLabel(FINAL_EVALUATION_TIMELINE_ACTIONS.approved, false)).toContain("approved");
    expect(timelineActionLabel(FINAL_EVALUATION_TIMELINE_ACTIONS.aiVerified, true)).toContain("التحقق");
  });
});

describe("final evaluation — models & services", () => {
  it("exports TrainingFinalStudentEvaluation model", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/models/TrainingFinalStudentEvaluation.ts", "utf8");
    expect(src).toContain("objectivesClarityScore");
    expect(src).toContain("overallSatisfactionScore");
  });

  it("exports TrainingFinalInstitutionEvaluation model with aiVerification", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/models/TrainingFinalInstitutionEvaluation.ts", "utf8");
    expect(src).toContain("evaluationMode");
    expect(src).toContain("aiVerification");
    expect(src).toContain("passedTraining");
  });

  it("exports PDF generator with report header", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/partnerships/training-final-report-pdf-generator.ts", "utf8");
    expect(src).toContain("report-header.png");
    expect(src).toContain("generateTrainingFinalReportPdfBuffer");
  });

  it("exports AI review service", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/partnerships/training-final-report-ai-review-service.ts", "utf8");
    expect(src).toContain("runTrainingFinalReportAiReview");
    expect(src).toContain("verificationScore");
  });

  it("exports supervisor review service", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/partnerships/training-final-evaluation-supervisor-service.ts", "utf8");
    expect(src).toContain("reviewFinalEvaluation");
    expect(src).toContain("maybeRequestFinalEvaluationReview");
  });

  it("exports career integration hook without modifying career engine", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/partnerships/training-final-evaluation-career-hook.ts", "utf8");
    expect(src).toContain("buildStudentCareerProfile");
    expect(src).toContain("FINAL_EVALUATION_CAREER_EVENT");
  });

  it("extends partnership intelligence analytics", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/partnerships/institution-performance-intelligence-service.ts", "utf8");
    expect(src).toContain("finalEvaluationAnalytics");
    expect(src).toContain("buildFinalEvaluationAnalytics");
  });
});

describe("final evaluation — score validation", () => {
  it("validates 1-5 and 1-10 scales", () => {
    expect(isScore1to5(3)).toBe(true);
    expect(isScore1to5(6)).toBe(false);
    expect(isScore1to10(10)).toBe(true);
    expect(isScore1to10(11)).toBe(false);
  });
});

describe("final evaluation — API routes", () => {
  it("exposes student final evaluation API", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(
      "src/app/api/partnerships/applications/[id]/final-evaluation/student/route.ts",
      "utf8"
    );
    expect(src).toContain("submitStudentFinalEvaluation");
  });

  it("exposes admin final evaluations API", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/api/admin/partnerships/final-evaluations/route.ts", "utf8");
    expect(src).toContain("listFinalEvaluationsForSupervisor");
  });
});
