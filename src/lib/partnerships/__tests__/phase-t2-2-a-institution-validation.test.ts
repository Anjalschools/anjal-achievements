import { describe, expect, it } from "vitest";
import {
  INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE,
  type InstitutionFinalReportExtractionResult,
} from "@/lib/partnerships/institution-final-report-constants";
import { applyInstitutionExtractionToRecord } from "@/lib/partnerships/institution-final-report-auto-populate";
import {
  institutionReportValidationStatusLabel,
  validateInstitutionFinalReport,
} from "@/lib/partnerships/institution-final-report-validation";

const completeExtraction = (
  overrides: Partial<InstitutionFinalReportExtractionResult> = {}
): InstitutionFinalReportExtractionResult => ({
  supervisorName: "مشرف التدريب",
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
  ocrConfidence: INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE,
  overallConfidence: INSTITUTION_REPORT_AUTO_POPULATE_CONFIDENCE,
  hasSignature: true,
  hasStamp: true,
  extractionMethod: "hybrid",
  ocrTextPreview:
    "الالتزام بالحضور 5 الانضباط المهني 4 الأخلاقيات المهنية 5 التوقيع: أحمد محمد مختوم ختم المؤسسة",
  ...overrides,
});

describe("phase T.2.2.A — institution final report validation", () => {
  it("approves a complete report with high confidence", () => {
    const result = validateInstitutionFinalReport(completeExtraction());
    expect(result.ratingsDetected).toBe(10);
    expect(result.missingRatings).toBe(0);
    expect(result.stampDetected).toBe(true);
    expect(result.signatureDetected).toBe(true);
    expect(result.approvalComplete).toBe(true);
    expect(result.reviewStatus).toBe("APPROVED");
    expect(result.riskFlags).toHaveLength(0);
  });

  it("flags missing evaluations with Arabic warning", () => {
    const result = validateInstitutionFinalReport(
      completeExtraction({
        safetyRating: undefined,
        taskExecutionRating: undefined,
      })
    );
    expect(result.ratingsDetected).toBe(8);
    expect(result.missingRatings).toBe(2);
    expect(result.riskFlags).toContain("MISSING_EVALUATIONS");
    expect(result.warnings).toContain("اتباع أنظمة السلامة: غير مقيم");
    expect(result.warnings).toContain("جودة تنفيذ المهام: غير مقيم");
    expect(result.reviewStatus).toBe("REQUIRES_REVIEW");
  });

  it("flags invalid rating rows with multiple selections", () => {
    const ocrText =
      "الالتزام بالحضور ✓ 4 ✓ 5 الانضباط المهني 4 الأخلاقيات المهنية 5 التواصل 4 العمل الجماعي 5 المبادرة 4 المهارات التقنية 5 حل المشكلات 4 جودة تنفيذ المهام 5 اتباع أنظمة السلامة 5 التوقيع: أحمد مختوم";
    const result = validateInstitutionFinalReport(
      completeExtraction({ attendanceRating: undefined, ocrTextPreview: ocrText }),
      ocrText
    );
    expect(result.invalidRatingRows).toContain("attendanceRating");
    expect(result.riskFlags).toContain("INVALID_RATING_ROW");
    expect(result.riskFlags).toContain("MULTIPLE_SELECTIONS");
  });

  it("flags missing stamp and signature", () => {
    const result = validateInstitutionFinalReport(
      completeExtraction({
        hasStamp: false,
        hasSignature: false,
        ocrTextPreview: "تقرير التدريب بدون ختم أو توقيع",
      }),
      "تقرير التدريب بدون ختم أو توقيع"
    );
    expect(result.stampDetected).toBe(false);
    expect(result.signatureDetected).toBe(false);
    expect(result.riskFlags).toContain("MISSING_STAMP");
    expect(result.riskFlags).toContain("MISSING_SIGNATURE");
    expect(result.warnings).toContain("لا يوجد ختم رسمي للمؤسسة.");
    expect(result.warnings).toContain("لا يوجد توقيع معتمد.");
  });

  it("flags OCR/AI review failure instead of silently passing", () => {
    const result = validateInstitutionFinalReport(
      completeExtraction({
        confidenceScore: 0,
        ocrConfidence: 0,
        visionConfidence: 0,
        overallConfidence: 0,
        extractionMethod: "heuristic",
        ocrTextPreview: "",
        supervisorName: undefined,
        positionTitle: undefined,
        attendanceRating: undefined,
        disciplineRating: undefined,
        ethicsRating: undefined,
        communicationRating: undefined,
        teamworkRating: undefined,
        initiativeRating: undefined,
        technicalSkillsRating: undefined,
        problemSolvingRating: undefined,
        taskExecutionRating: undefined,
        safetyRating: undefined,
        hasStamp: false,
        hasSignature: false,
      }),
      ""
    );
    expect(result.riskFlags).toContain("AI_REVIEW_FAILED");
    expect(result.riskFlags).toContain("OCR_FAILED");
    expect(result.reviewStatus).toBe("REQUIRES_REVIEW");
    expect(institutionReportValidationStatusLabel(result, "ar")).toBe("بحاجة مراجعة");
  });

  it("flags incomplete approval fields", () => {
    const result = validateInstitutionFinalReport(
      completeExtraction({
        supervisorName: "",
        positionTitle: "",
        hasSignature: false,
        ocrTextPreview: "تقرير بدون اعتماد",
      }),
      "تقرير بدون اعتماد"
    );
    expect(result.approvalComplete).toBe(false);
    expect(result.riskFlags).toContain("APPROVAL_INCOMPLETE");
  });

  it("stores validation metadata on uploaded reports", () => {
    const record: Record<string, unknown> = {};
    applyInstitutionExtractionToRecord(
      record as Parameters<typeof applyInstitutionExtractionToRecord>[0],
      completeExtraction(),
      "uploaded_pdf"
    );
    const meta = record.institutionReportExtraction as Record<string, unknown>;
    expect(meta.reviewStatus).toBe("APPROVED");
    expect(Array.isArray(meta.riskFlags)).toBe(true);
    expect(meta.validationResult).toBeTruthy();
  });
});
