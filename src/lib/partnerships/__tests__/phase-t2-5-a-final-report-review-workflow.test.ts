import { describe, expect, it, vi } from "vitest";
import {
  buildInstitutionReportValidationDiagnostics,
} from "@/lib/partnerships/institution-final-report-validation-diagnostics";
import {
  buildInstitutionReportVisualEvidence,
  resolveInstitutionReportVisualEvidence,
} from "@/lib/partnerships/institution-final-report-visual-evidence";
import {
  canTransitionCompletionStatus,
  getAllowedCompletionTransitions,
} from "@/lib/partnerships/partnerships-state-machine";
import { attachmentDisplayUrl } from "@/lib/partnerships/training-completion-upload";

describe("phase T.2.5.A — final report review workflow fixes", () => {
  it("allows submitted → needs_revision", () => {
    expect(canTransitionCompletionStatus("submitted", "needs_revision")).toBe(true);
    expect(getAllowedCompletionTransitions("submitted")).toContain("needs_revision");
  });

  it("allows needs_revision → resubmitted", () => {
    expect(canTransitionCompletionStatus("needs_revision", "resubmitted")).toBe(true);
  });

  it("allows resubmitted → approved and rejected", () => {
    expect(canTransitionCompletionStatus("resubmitted", "approved")).toBe(true);
    expect(canTransitionCompletionStatus("resubmitted", "rejected")).toBe(true);
  });

  it("blocks submitted → pending (legacy revision path)", () => {
    expect(canTransitionCompletionStatus("submitted", "pending")).toBe(false);
  });

  it("regenerates visual evidence from validationResult on read", () => {
    const validationResult = {
      reviewStatus: "REQUIRES_REVIEW",
      ratingsDetected: 10,
      expectedRatings: 10,
      stampDetected: true,
      signatureDetected: true,
      confidence: 88,
      overallConfidence: 88,
      ocrConfidence: 80,
      visionConfidence: 90,
      ratingRowDetails: [],
      riskFlags: [],
      warnings: [],
    };
    const rebuilt = resolveInstitutionReportVisualEvidence(
      { validationResult },
      "reports/sample.pdf"
    );
    expect(rebuilt?.regions.length).toBeGreaterThan(0);
    expect(rebuilt?.reportFileKey).toBe("reports/sample.pdf");
  });

  it("builds OCR failure diagnostics with explicit reason", () => {
    const diagnostics = buildInstitutionReportValidationDiagnostics(
      {
        extractionMethod: "ocr",
        ocrTextPreview: "",
        riskFlags: ["OCR_FAILED"],
        validationResult: {
          reviewStatus: "REQUIRES_REVIEW",
          riskFlags: ["OCR_FAILED"],
          warnings: ["No readable pages detected"],
        },
      },
      { fileName: "report.pdf" }
    );
    expect(diagnostics?.ocrExecuted).toBe(true);
    expect(diagnostics?.ocrError).toBe("OCR extraction failed");
    expect(diagnostics?.failureReasonEn).toContain("OCR");
  });

  it("builds Vision failure diagnostics with explicit reason", () => {
    const diagnostics = buildInstitutionReportValidationDiagnostics(
      {
        extractionMethod: "vision",
        riskFlags: ["AI_REVIEW_FAILED"],
        validationResult: {
          reviewStatus: "REQUIRES_REVIEW",
          riskFlags: ["AI_REVIEW_FAILED"],
        },
      },
      { fileName: "scan.png" }
    );
    expect(diagnostics?.visionExecuted).toBe(true);
    expect(diagnostics?.visionError).toBe("Vision extraction failed");
  });

  it("supports preview/download URL resolution for institution report files", () => {
    vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_BASE_URL", "https://cdn.example.com");
    expect(attachmentDisplayUrl("https://cdn.example.com/report.pdf")).toBe(
      "https://cdn.example.com/report.pdf"
    );
    expect(attachmentDisplayUrl("achievements/attachments/2025/report.pdf")).toBe(
      "https://cdn.example.com/achievements/attachments/2025/report.pdf"
    );
  });

  it("keeps visual evidence builder compatible with validation result", () => {
    const evidence = buildInstitutionReportVisualEvidence({
      validationResult: {
        reviewStatus: "APPROVED",
        ratingsDetected: 10,
        expectedRatings: 10,
        stampDetected: true,
        signatureDetected: false,
        confidence: 91,
        overallConfidence: 91,
        ocrConfidence: 85,
        visionConfidence: 92,
        ratingRowDetails: [],
        riskFlags: [],
        warnings: [],
      },
      reportFileKey: "file.pdf",
    });
    expect(evidence.regions.some((row) => row.id === "stamp")).toBe(true);
  });
});
