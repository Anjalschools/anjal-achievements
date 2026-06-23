import type {
  InstitutionReportReviewStatus,
  InstitutionReportValidationResult,
} from "@/lib/partnerships/institution-final-report-constants";
import { formatInstitutionReportExtractionMethod } from "@/lib/partnerships/institution-final-report-constants";
import { institutionReportValidationStatusLabel } from "@/lib/partnerships/institution-final-report-validation";

export type InstitutionReportValidationView = {
  confidenceScore?: number;
  ocrConfidence?: number;
  visionConfidence?: number;
  overallConfidence?: number;
  hasSignature?: boolean;
  hasStamp?: boolean;
  extractionMethod?: string;
  manualVerification?: boolean;
  manualVerifiedAt?: string | null;
  reviewStatus?: InstitutionReportReviewStatus;
  validationResult?: InstitutionReportValidationResult | null;
};

export { institutionReportValidationStatusLabel };

export const institutionReportExtractionMethodLabel = (
  method: string | undefined,
  locale: "ar" | "en"
) => {
  const normalized = String(method || "").toLowerCase();
  if (normalized === "vision") return locale === "ar" ? "رؤية" : "Vision";
  if (normalized === "hybrid") return locale === "ar" ? "مختلط" : "Hybrid";
  if (normalized === "ocr" || normalized === "heuristic") return locale === "ar" ? "OCR" : "OCR";
  return method || (locale === "ar" ? "غير متوفر" : "Unavailable");
};

export const pickInstitutionReportValidationView = (
  extraction: unknown
): InstitutionReportValidationView | null => {
  if (!extraction || typeof extraction !== "object") return null;
  const row = extraction as Record<string, unknown>;
  const validationResult =
    row.validationResult && typeof row.validationResult === "object"
      ? (row.validationResult as InstitutionReportValidationResult)
      : null;

  return {
    confidenceScore:
      typeof row.overallConfidence === "number"
        ? row.overallConfidence
        : typeof row.confidenceScore === "number"
          ? row.confidenceScore
          : undefined,
    ocrConfidence:
      typeof row.ocrConfidence === "number"
        ? row.ocrConfidence
        : validationResult?.ocrConfidence,
    visionConfidence:
      typeof row.visionConfidence === "number"
        ? row.visionConfidence
        : validationResult?.visionConfidence,
    overallConfidence:
      typeof row.overallConfidence === "number"
        ? row.overallConfidence
        : validationResult?.overallConfidence ?? validationResult?.confidence,
    hasSignature: row.hasSignature === true,
    hasStamp: row.hasStamp === true,
    extractionMethod:
      validationResult?.extractionMethod ||
      formatInstitutionReportExtractionMethod(
        row.extractionMethod as "ocr" | "vision" | "hybrid" | "heuristic" | undefined
      ),
    manualVerification: row.manualVerification === true,
    manualVerifiedAt:
      typeof row.manualVerifiedAt === "string" || row.manualVerifiedAt instanceof Date
        ? new Date(row.manualVerifiedAt as string).toISOString()
        : null,
    reviewStatus:
      row.reviewStatus === "APPROVED" || row.reviewStatus === "REQUIRES_REVIEW"
        ? row.reviewStatus
        : validationResult?.reviewStatus,
    validationResult,
  };
};
