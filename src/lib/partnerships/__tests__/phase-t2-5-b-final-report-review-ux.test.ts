import { describe, expect, it, vi } from "vitest";
import { computeFinalReportReviewEmptyStateStats } from "@/lib/partnerships/final-report-review-empty-state-stats";
import {
  getConsistencyClassification,
  getDiagnosticsSummaryStatus,
  humanizeValidationFailure,
  isPreviewableInstitutionReport,
  isReviewNoteSufficient,
  validateSupervisorReviewNote,
} from "@/lib/partnerships/final-report-review-ux-constants";
import { attachmentDisplayUrl } from "@/lib/partnerships/training-completion-upload";

describe("phase T.2.5.B — final report review UX hardening", () => {
  it("requires review note for request revision", () => {
    const empty = validateSupervisorReviewNote("", "request_changes", "ar");
    expect(empty.valid).toBe(false);
    expect(empty.message).toContain("يجب كتابة المطلوب تعديله");

    const short = validateSupervisorReviewNote("قصير", "request_changes", "ar");
    expect(short.valid).toBe(false);

    const valid = validateSupervisorReviewNote("يرجى تعديل ساعات التدريب في التقرير", "request_changes", "ar");
    expect(valid.valid).toBe(true);
    expect(isReviewNoteSufficient("يرجى تعديل ساعات التدريب في التقرير")).toBe(true);
  });

  it("requires review note for reject", () => {
    const empty = validateSupervisorReviewNote("", "reject", "ar");
    expect(empty.valid).toBe(false);
    expect(empty.message).toContain("سبب الرفض");

    const valid = validateSupervisorReviewNote("التقرير غير مكتمل ولا يستوفي المتطلبات", "reject", "ar");
    expect(valid.valid).toBe(true);
  });

  it("classifies consistency score for student-facing explanation", () => {
    expect(getConsistencyClassification(55, "ar").label).toBe("متوسط");
    expect(getConsistencyClassification(90, "ar").label).toBe("ممتاز");
    expect(getConsistencyClassification(30, "en").label).toBe("Very low");
  });

  it("humanizes OCR and Vision failure messages", () => {
    expect(humanizeValidationFailure("OCR extraction failed", "ar")).toBe(
      "فشل استخراج النص من الملف."
    );
    expect(humanizeValidationFailure("Vision extraction failed", "ar")).toBe(
      "تعذر تحليل الملف بصرياً."
    );
    expect(humanizeValidationFailure("Unsupported PDF structure", "ar")).toBe(
      "بنية الملف غير مدعومة للتحليل."
    );
    expect(humanizeValidationFailure("No readable pages detected", "ar")).toBe(
      "تعذر اكتشاف صفحات قابلة للمعالجة."
    );
  });

  it("derives diagnostics summary status cards", () => {
    expect(
      getDiagnosticsSummaryStatus(
        { validationResult: { reviewStatus: "APPROVED", ratingsDetected: 10, expectedRatings: 10 } },
        { ocrExecuted: true, visionExecuted: true }
      )
    ).toBe("valid");

    expect(
      getDiagnosticsSummaryStatus(
        { validationResult: { reviewStatus: "REQUIRES_REVIEW", ratingsDetected: 8, expectedRatings: 10 } },
        { ocrExecuted: true, visionExecuted: true }
      )
    ).toBe("requires_review");

    expect(
      getDiagnosticsSummaryStatus(null, { ocrExecuted: true, visionExecuted: false, ocrError: "OCR extraction failed" })
    ).toBe("incomplete");
  });

  it("computes empty-state dashboard stats from existing list payload", () => {
    const stats = computeFinalReportReviewEmptyStateStats([
      {
        status: "submitted",
        volunteerHours: 40,
        institutionReportExtraction: {
          validationResult: { reviewStatus: "APPROVED" },
        },
      },
      {
        status: "needs_revision",
        volunteerHours: 30,
        institutionReportExtraction: {
          validationResult: { reviewStatus: "REQUIRES_REVIEW" },
        },
      },
      {
        status: "resubmitted",
        volunteerHours: 35,
        institutionReportExtraction: {
          validationResult: { reviewStatus: "APPROVED" },
        },
      },
    ]);

    expect(stats.awaitingReview).toBe(2);
    expect(stats.needsRevision).toBe(1);
    expect(stats.averageConsistencyScore).not.toBeNull();
    expect(stats.validationSuccessRate).toBe(67);
  });

  it("supports previewable institution report file types", () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_BASE_URL", "https://cdn.example.com");
    expect(isPreviewableInstitutionReport("report.pdf")).toBe(true);
    expect(isPreviewableInstitutionReport("scan.PNG")).toBe(true);
    expect(isPreviewableInstitutionReport("notes.docx")).toBe(false);
    expect(attachmentDisplayUrl("https://cdn.example.com/report.pdf")).toBe(
      "https://cdn.example.com/report.pdf"
    );
  });

  it("student revision banner is shown for needs_revision", async () => {
    const fs = await import("node:fs/promises");
    const pageSrc = await fs.readFile("src/app/(app)/summer-training/final-report/page.tsx", "utf8");
    const bannerSrc = await fs.readFile("src/components/partnerships/StudentRevisionBanner.tsx", "utf8");
    expect(pageSrc).toContain("StudentRevisionBanner");
    expect(pageSrc).toContain('status === "needs_revision"');
    expect(bannerSrc).toContain("تم إرجاع التقرير للتعديل");
  });

  it("student resubmission CTA scrolls to upload section", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/app/(app)/summer-training/final-report/page.tsx", "utf8");
    expect(src).toContain("إعادة إرسال التقرير");
    expect(src).toContain("institution-report-upload");
    expect(src).toContain("handleScrollToResubmit");
  });

  it("preview modal actions component exists with required labels", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/partnerships/InstitutionReportPreviewActions.tsx", "utf8");
    expect(src).toContain("معاينة التقرير");
    expect(src).toContain("تحميل التقرير");
    expect(src).toContain("فتح في نافذة جديدة");
    expect(src).toContain('role="dialog"');
    expect(src).toContain("<iframe");
  });

  it("diagnostics panel uses collapsible technical accordion", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(
      "src/components/partnerships/InstitutionReportValidationDiagnosticsPanel.tsx",
      "utf8"
    );
    const constantsSrc = await fs.readFile(
      "src/lib/partnerships/final-report-review-ux-constants.ts",
      "utf8"
    );
    expect(src).toContain("عرض التفاصيل التقنية");
    expect(src).toContain("aria-expanded");
    expect(src).toContain("diagnosticsSummaryLabel");
    expect(constantsSrc).toContain("صالح");
  });

  it("approval override dialog includes confidence and override actions", async () => {
    const fs = await import("node:fs/promises");
    const adminSrc = await fs.readFile("src/app/(app)/admin/partnerships/final-reports/page.tsx", "utf8");
    const dialogSrc = await fs.readFile(
      "src/components/partnerships/FinalReportApprovalOverrideDialog.tsx",
      "utf8"
    );
    expect(adminSrc).toContain("FinalReportApprovalOverrideDialog");
    expect(dialogSrc).toContain("اعتماد رغم ذلك");
    expect(dialogSrc).toContain("درجة التحقق الحالية");
    expect(dialogSrc).toContain("هل تريد الاعتماد رغم ذلك");
  });

  it("consistency explanation panel renders score classification", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/partnerships/ConsistencyExplanationPanel.tsx", "utf8");
    expect(src).toContain("درجة الاتساق");
    expect(src).toContain("لا توجد تفاصيل إضافية");
  });

  it("empty state dashboard component renders review summary", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/components/partnerships/FinalReportReviewEmptyState.tsx", "utf8");
    expect(src).toContain("بانتظار المراجعة");
    expect(src).toContain("معدل نجاح التحقق");
  });
});
