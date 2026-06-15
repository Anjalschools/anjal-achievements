import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  QUALITY_SCORE_BANDS,
  PARTNERSHIP_ALERT_TYPES,
  SUPERVISOR_FEEDBACK_DIMENSIONS,
  qualityLabelForScore,
} from "@/lib/partnerships/institution-performance-intelligence-constants";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => undefined) }));

const readSrc = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Phase 10.3 — partnership quality & institution performance intelligence", () => {
  it("registers InstitutionPerformanceSnapshot model", () => {
    const src = readSrc("src/models/InstitutionPerformanceSnapshot.ts");
    expect(src).toContain("organizationId");
    expect(src).toContain("academicYearId");
    expect(src).toContain("academicYearLabel");
    expect(src).toContain("generatedAt");
    expect(src).toContain("metrics");
    expect(src).toContain("qualityScore");
    expect(src).toContain("responseTime");
  });

  it("registers InstitutionSupervisorFeedback model", () => {
    const src = readSrc("src/models/InstitutionSupervisorFeedback.ts");
    expect(src).toContain("cooperation");
    expect(src).toContain("commitment");
    expect(src).toContain("responseSpeed");
    expect(src).toContain("reportQuality");
    expect(src).toContain("communication");
  });

  it("registers InstitutionAnnualReview model", () => {
    const src = readSrc("src/models/InstitutionAnnualReview.ts");
    expect(src).toContain("renewalDecision");
    expect(src).toContain("performanceSummaryAr");
    expect(src).toContain("recommendationsEn");
    expect(src).toContain("snapshotId");
  });

  it("defines quality score bands", () => {
    expect(QUALITY_SCORE_BANDS[0].min).toBe(92);
    expect(qualityLabelForScore(95, true)).toBe("ممتاز");
    expect(qualityLabelForScore(85, false)).toBe("Very good");
    expect(qualityLabelForScore(65, true)).toBe("يحتاج تحسين");
  });

  it("defines partnership alert types", () => {
    expect(PARTNERSHIP_ALERT_TYPES).toContain("no_response");
    expect(PARTNERSHIP_ALERT_TYPES).toContain("missing_reports");
    expect(PARTNERSHIP_ALERT_TYPES).toContain("exemplary");
  });

  it("defines supervisor feedback dimensions", () => {
    expect(SUPERVISOR_FEEDBACK_DIMENSIONS).toHaveLength(5);
    expect(SUPERVISOR_FEEDBACK_DIMENSIONS).toContain("reportQuality");
  });

  it("exports performance intelligence service helpers", () => {
    const src = readSrc("src/lib/partnerships/institution-performance-intelligence-service.ts");
    expect(src).toContain("buildInstitutionPerformanceMetrics");
    expect(src).toContain("computeInstitutionQualityScore");
    expect(src).toContain("upsertInstitutionPerformanceSnapshot");
    expect(src).toContain("buildPartnershipIntelligenceDashboard");
    expect(src).toContain("buildPartnershipAlerts");
    expect(src).toContain("generateInstitutionAnnualReview");
    expect(src).toContain("submitSupervisorInstitutionFeedback");
    expect(src).toContain("buildSchoolPartnershipIndicators");
  });

  it("computes quality score deterministically", async () => {
    const { computeInstitutionQualityScore } = await import(
      "@/lib/partnerships/institution-performance-intelligence-service"
    );
    const score = computeInstitutionQualityScore({
      responseTime: {
        firstResponseAvgDays: 2,
        firstResponseMedianDays: 2,
        reviewAvgDays: 3,
        interviewScheduleAvgDays: 4,
        finalReportAvgDays: 5,
        averageResponseTimeDays: 3,
        medianResponseTimeDays: 3,
        fastestResponseDays: 1,
        slowestResponseDays: 7,
      },
      acceptanceRatePct: 60,
      completionRatePct: 80,
      reportCompletionRatePct: 90,
      messageEngagementPct: 75,
      interviewAttendancePct: 85,
      studentFeedbackAvg: 4.2,
    });
    expect(score).toBeGreaterThanOrEqual(70);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("exposes intelligence admin API routes", () => {
    expect(readSrc("src/app/api/admin/partnerships/intelligence/route.ts")).toContain(
      "buildPartnershipIntelligenceDashboard"
    );
    expect(readSrc("src/app/api/admin/partnerships/intelligence/snapshots/route.ts")).toContain(
      "upsertInstitutionPerformanceSnapshot"
    );
    expect(readSrc("src/app/api/admin/partnerships/organizations/[id]/supervisor-feedback/route.ts")).toContain(
      "submitSupervisorInstitutionFeedback"
    );
    expect(readSrc("src/app/api/admin/partnerships/organizations/[id]/annual-review/route.ts")).toContain(
      "generateInstitutionAnnualReview"
    );
  });

  it("registers intelligence admin page and executive widget", () => {
    expect(readSrc("src/app/(app)/admin/partnerships/intelligence/page.tsx")).toContain(
      "/api/admin/partnerships/intelligence"
    );
    expect(readSrc("src/components/admin/PartnershipIntelligenceWidget.tsx")).toContain(
      "partnershipCount"
    );
    expect(readSrc("src/app/(app)/admin/executive-intelligence/page.tsx")).toContain(
      "PartnershipIntelligenceWidget"
    );
  });

  it("integrates with executive and school improvement services", () => {
    expect(readSrc("src/lib/analytics/executive-decision-intelligence-service.ts")).toContain(
      "partnershipIntelligence"
    );
    expect(readSrc("src/lib/school-improvement/school-improvement-service.ts")).toContain(
      "partnershipIndicators"
    );
    expect(readSrc("src/lib/school-improvement/school-improvement-types.ts")).toContain(
      "partnershipIndicators"
    );
  });

  it("preserves student feedback without workflow changes", () => {
    const feedbackSrc = readSrc("src/lib/partnerships/institution-student-feedback-service.ts");
    expect(feedbackSrc).toContain("student_feedback");
    expect(feedbackSrc).not.toContain("InstitutionPerformanceSnapshot");
    const workflowSrc = readSrc("src/lib/partnerships/partnerships-application-workflow.ts");
    expect(workflowSrc).not.toContain("institution_performance");
  });

  it("does not modify recruitment pipeline or contact governance", () => {
    const pipelineSrc = readSrc("src/lib/partnerships/institution-candidate-pipeline-service.ts");
    expect(pipelineSrc).not.toContain("InstitutionPerformanceSnapshot");
    const contactSrc = readSrc("src/lib/partnerships/institution-contact-access-service.ts");
    expect(contactSrc).not.toContain("InstitutionAnnualReview");
  });
});
