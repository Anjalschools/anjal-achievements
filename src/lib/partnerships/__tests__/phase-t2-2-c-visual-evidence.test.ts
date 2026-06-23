import { describe, expect, it } from "vitest";
import {
  INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE,
  INSTITUTION_REPORT_RATING_FIELDS,
  type InstitutionReportValidationResult,
} from "@/lib/partnerships/institution-final-report-constants";
import { applyInstitutionExtractionToRecord } from "@/lib/partnerships/institution-final-report-auto-populate";
import type { InstitutionFinalReportExtractionResult } from "@/lib/partnerships/institution-final-report-constants";
import {
  buildInstitutionReportVisualEvidence,
  resolveInstitutionReportVisualEvidence,
} from "@/lib/partnerships/institution-final-report-visual-evidence";

const sampleValidation = (): InstitutionReportValidationResult => ({
  ratingsDetected: 8,
  expectedRatings: 10,
  missingRatings: 2,
  missingRatingKeys: ["problemSolvingRating", "taskExecutionRating"],
  invalidRatingRows: [],
  stampDetected: false,
  signatureDetected: true,
  recommendationDetected: true,
  approvalFieldsDetected: { supervisorName: true, positionTitle: true, signature: true },
  approvalComplete: true,
  confidence: 88,
  ocrConfidence: 78,
  visionConfidence: 96,
  overallConfidence: 88,
  stampConfidence: 12,
  signatureConfidence: 91,
  extractionMethod: "HYBRID",
  ratingRowDetails: INSTITUTION_REPORT_RATING_FIELDS.map((field, index) => ({
    key: field.key,
    labelAr: field.labelAr,
    rowStatus: index < 8 ? "VALID" : "EMPTY",
    selectedRating: index < 8 ? 5 - (index % 2) : undefined,
  })),
  reviewStatus: "REQUIRES_REVIEW",
  riskFlags: ["MISSING_STAMP", "MISSING_EVALUATIONS"],
  warnings: ["حل المشكلات: غير مقيم"],
});

describe("phase T.2.2.C — visual evidence review layer", () => {
  it("builds visual evidence regions and confidence explanation", () => {
    const evidence = buildInstitutionReportVisualEvidence({
      validationResult: sampleValidation(),
      reportFileKey: "reports/sample.pdf",
    });

    expect(evidence.regions).toHaveLength(3);
    expect(evidence.regions.find((region) => region.id === "stamp")?.detected).toBe(false);
    expect(evidence.regions.find((region) => region.id === "stamp")?.messageAr).toContain("لم يتم العثور على ختم");
    expect(evidence.regions.find((region) => region.id === "signature")?.detected).toBe(true);
    expect(evidence.confidenceExplanation.ocrConfidence).toBe(78);
    expect(evidence.confidenceExplanation.visionConfidence).toBe(96);
    expect(evidence.confidenceExplanation.stampDetectionConfidence).toBe(12);
    expect(evidence.confidenceExplanation.signatureDetectionConfidence).toBe(91);
  });

  it("maps rating matrix rows with detected checkbox columns", () => {
    const evidence = buildInstitutionReportVisualEvidence({ validationResult: sampleValidation() });
    const attendance = evidence.ratingMatrix.find((row) => row.key === "attendanceRating");
    const missing = evidence.ratingMatrix.find((row) => row.key === "taskExecutionRating");

    expect(attendance?.detected).toBe(true);
    expect(attendance?.selectedRating).toBe(5);
    expect(missing?.detected).toBe(false);
    expect(missing?.rowStatus).toBe("EMPTY");
  });

  it("resolves evidence from stored metadata or validation fallback", () => {
    const built = buildInstitutionReportVisualEvidence({ validationResult: sampleValidation() });
    const fromStored = resolveInstitutionReportVisualEvidence({ visualEvidence: built });
    const fromValidation = resolveInstitutionReportVisualEvidence({
      validationResult: sampleValidation(),
    });

    expect(fromStored?.regions).toHaveLength(3);
    expect(fromValidation?.ratingMatrix).toHaveLength(10);
  });

  it("stores visual evidence metadata on upload without changing validation", () => {
    const extraction: InstitutionFinalReportExtractionResult = {
      supervisorName: "مشرف",
      positionTitle: "مشرف مباشر",
      attendanceRating: 5,
      disciplineRating: 4,
      ethicsRating: 5,
      communicationRating: 4,
      teamworkRating: 5,
      initiativeRating: 4,
      technicalSkillsRating: 5,
      problemSolvingRating: 4,
      taskExecutionRating: 5,
      safetyRating: 5,
      recommendation: "recommended",
      confidenceScore: INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE,
      ocrConfidence: 80,
      visionConfidence: 90,
      overallConfidence: INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE,
      hasSignature: true,
      hasStamp: true,
      extractionMethod: "hybrid",
      validationResult: sampleValidation(),
    };

    const record: Record<string, unknown> = {};
    applyInstitutionExtractionToRecord(
      record as Parameters<typeof applyInstitutionExtractionToRecord>[0],
      extraction,
      "uploaded_pdf",
      "reports/test.pdf"
    );

    const meta = record.institutionReportExtraction as Record<string, unknown>;
    expect(meta.visualEvidence).toBeTruthy();
    expect((meta.validationResult as InstitutionReportValidationResult).reviewStatus).toBe("REQUIRES_REVIEW");
  });
});
