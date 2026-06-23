import { describe, expect, it } from "vitest";
import {
  INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE,
  type InstitutionFinalReportExtractionResult,
} from "@/lib/partnerships/institution-final-report-constants";
import { validateInstitutionFinalReport } from "@/lib/partnerships/institution-final-report-validation";
import type { InstitutionReportVisionVerification } from "@/lib/partnerships/institution-final-report-vision-shared";

const buildVisionVerification = (
  overrides: Partial<InstitutionReportVisionVerification> = {}
): InstitutionReportVisionVerification => ({
  ratingRows: [
    { key: "attendanceRating", rowStatus: "VALID", selectedRating: 5, confidence: 90 },
    { key: "disciplineRating", rowStatus: "VALID", selectedRating: 4, confidence: 88 },
    { key: "ethicsRating", rowStatus: "VALID", selectedRating: 5, confidence: 90 },
    { key: "communicationRating", rowStatus: "VALID", selectedRating: 4, confidence: 86 },
    { key: "teamworkRating", rowStatus: "VALID", selectedRating: 5, confidence: 87 },
    { key: "initiativeRating", rowStatus: "VALID", selectedRating: 4, confidence: 85 },
    { key: "technicalSkillsRating", rowStatus: "VALID", selectedRating: 5, confidence: 89 },
    { key: "problemSolvingRating", rowStatus: "EMPTY", confidence: 70 },
    { key: "taskExecutionRating", rowStatus: "EMPTY", confidence: 68 },
    { key: "safetyRating", rowStatus: "VALID", selectedRating: 5, confidence: 91 },
  ],
  stampDetected: true,
  stampConfidence: 88,
  signatureDetected: true,
  signatureConfidence: 86,
  visionConfidence: 92,
  ...overrides,
});

const scannedExtraction = (
  overrides: Partial<InstitutionFinalReportExtractionResult> = {}
): InstitutionFinalReportExtractionResult => ({
  supervisorName: "مشرف التدريب",
  positionTitle: "مشرف مباشر",
  recommendation: "recommended",
  confidenceScore: 0,
  ocrConfidence: 0,
  visionConfidence: 92,
  overallConfidence: 88,
  hasSignature: true,
  hasStamp: true,
  extractionMethod: "vision",
  ocrTextPreview: "",
  visionVerification: buildVisionVerification(),
  attendanceRating: 5,
  disciplineRating: 4,
  ethicsRating: 5,
  communicationRating: 4,
  teamworkRating: 5,
  initiativeRating: 4,
  technicalSkillsRating: 5,
  safetyRating: 5,
  ...overrides,
});

describe("phase T.2.2.B — vision-based institution report verification", () => {
  it("detects ratings from vision when OCR is empty", () => {
    const result = validateInstitutionFinalReport(scannedExtraction(), "");
    expect(result.ratingsDetected).toBe(8);
    expect(result.riskFlags).not.toContain("AI_REVIEW_FAILED");
    expect(result.ocrConfidence).toBe(0);
    expect(result.visionConfidence).toBe(92);
    expect(result.overallConfidence).toBe(88);
    expect(result.extractionMethod).toBe("VISION");
  });

  it("uses vision stamp and signature without OCR text", () => {
    const result = validateInstitutionFinalReport(scannedExtraction(), "");
    expect(result.stampDetected).toBe(true);
    expect(result.signatureDetected).toBe(true);
    expect(result.stampConfidence).toBe(88);
    expect(result.signatureConfidence).toBe(86);
  });

  it("reports per-row missing evaluations in Arabic", () => {
    const result = validateInstitutionFinalReport(scannedExtraction(), "");
    expect(result.warnings).toContain("حل المشكلات: غير مقيم");
    expect(result.warnings).toContain("جودة تنفيذ المهام: غير مقيم");
    expect(result.ratingRowDetails?.find((row) => row.key === "problemSolvingRating")?.rowStatus).toBe(
      "EMPTY"
    );
  });

  it("flags multiple checkbox selections from vision", () => {
    const vision = buildVisionVerification({
      ratingRows: buildVisionVerification().ratingRows.map((row) =>
        row.key === "attendanceRating"
          ? { ...row, rowStatus: "MULTIPLE" as const, selectedRating: undefined }
          : row
      ),
    });
    const result = validateInstitutionFinalReport(
      scannedExtraction({ visionVerification: vision, attendanceRating: 5 }),
      ""
    );
    expect(result.invalidRatingRows).toContain("attendanceRating");
    expect(result.riskFlags).toContain("MULTIPLE_SELECTIONS");
  });

  it("approves when vision completes all checks with high overall confidence", () => {
    const vision = buildVisionVerification({
      ratingRows: buildVisionVerification().ratingRows.map((row) => ({
        ...row,
        rowStatus: "VALID" as const,
        selectedRating: row.selectedRating ?? 4,
      })),
    });
    const result = validateInstitutionFinalReport(
      scannedExtraction({
        visionVerification: vision,
        problemSolvingRating: 4,
        taskExecutionRating: 4,
        overallConfidence: INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE,
        confidenceScore: INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE,
      }),
      ""
    );
    expect(result.ratingsDetected).toBe(10);
    expect(result.reviewStatus).toBe("APPROVED");
  });

  it("includes rating row details for supervisor scan list", () => {
    const result = validateInstitutionFinalReport(scannedExtraction(), "");
    expect(result.ratingRowDetails?.length).toBe(10);
    expect(result.ratingRowDetails?.filter((row) => row.rowStatus === "VALID").length).toBe(8);
  });
});
