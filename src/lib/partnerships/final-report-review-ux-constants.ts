import type { InstitutionReportValidationDiagnostics } from "@/lib/partnerships/institution-final-report-validation-diagnostics";
import { TRAINING_INTELLIGENCE_RISK_LABELS } from "@/lib/partnerships/training-intelligence-constants";
import type { TrainingReportIntelligence } from "@/lib/partnerships/training-intelligence-types";
import type { InstitutionReportValidationView } from "@/lib/partnerships/institution-final-report-validation-ui";

export const REVIEW_NOTE_MIN_LENGTH = 10;

export type SupervisorReviewAction = "request_changes" | "reject";

export const REVIEW_NOTE_VALIDATION_MESSAGE = {
  ar: "يجب كتابة المطلوب تعديله قبل إرسال طلب التعديل.",
  en: "Describe what must be revised before sending the revision request.",
} as const;

export const REJECT_NOTE_VALIDATION_MESSAGE = {
  ar: "يجب كتابة سبب الرفض قبل إرسال الطلب.",
  en: "Describe the rejection reason before submitting.",
} as const;

export const isReviewNoteSufficient = (note: string, minLength = REVIEW_NOTE_MIN_LENGTH) =>
  note.trim().length >= minLength;

export const validateSupervisorReviewNote = (
  note: string,
  action: SupervisorReviewAction,
  locale: "ar" | "en"
): { valid: boolean; message: string } => {
  const trimmed = note.trim();
  if (!trimmed) {
    return {
      valid: false,
      message:
        action === "reject"
          ? REJECT_NOTE_VALIDATION_MESSAGE[locale]
          : REVIEW_NOTE_VALIDATION_MESSAGE[locale],
    };
  }
  if (trimmed.length < REVIEW_NOTE_MIN_LENGTH) {
    return {
      valid: false,
      message:
        locale === "ar"
          ? `يجب أن تكون الملاحظة ${REVIEW_NOTE_MIN_LENGTH} أحرف على الأقل.`
          : `The note must be at least ${REVIEW_NOTE_MIN_LENGTH} characters.`,
    };
  }
  return { valid: true, message: "" };
};

export type ConsistencyClassificationKey =
  | "excellent"
  | "good"
  | "average"
  | "low"
  | "very_low";

export const getConsistencyClassification = (
  score: number,
  locale: "ar" | "en"
): { key: ConsistencyClassificationKey; label: string } => {
  if (score >= 85) {
    return { key: "excellent", label: locale === "ar" ? "ممتاز" : "Excellent" };
  }
  if (score >= 70) {
    return { key: "good", label: locale === "ar" ? "جيد" : "Good" };
  }
  if (score >= 55) {
    return { key: "average", label: locale === "ar" ? "متوسط" : "Average" };
  }
  if (score >= 40) {
    return { key: "low", label: locale === "ar" ? "منخفض" : "Low" };
  }
  return { key: "very_low", label: locale === "ar" ? "منخفض جداً" : "Very low" };
};

export const CONSISTENCY_CLASSIFICATION_TONES: Record<ConsistencyClassificationKey, string> = {
  excellent: "border-emerald-200 bg-emerald-50 text-emerald-900",
  good: "border-blue-200 bg-blue-50 text-blue-900",
  average: "border-amber-200 bg-amber-50 text-amber-900",
  low: "border-orange-200 bg-orange-50 text-orange-900",
  very_low: "border-red-200 bg-red-50 text-red-900",
};

export const SEVERITY_TONES = {
  critical: "border-red-200 bg-red-50 text-red-900",
  warning: "border-orange-200 bg-orange-50 text-orange-900",
  information: "border-blue-200 bg-blue-50 text-blue-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
} as const;

const VALIDATION_FAILURE_MESSAGES: Record<string, { ar: string; en: string }> = {
  "ocr extraction failed": {
    ar: "فشل استخراج النص من الملف.",
    en: "Text extraction from the file failed.",
  },
  "vision extraction failed": {
    ar: "تعذر تحليل الملف بصرياً.",
    en: "Visual analysis of the file failed.",
  },
  "unsupported pdf structure": {
    ar: "بنية الملف غير مدعومة للتحليل.",
    en: "The file structure is not supported for analysis.",
  },
  "no readable pages detected": {
    ar: "تعذر اكتشاف صفحات قابلة للمعالجة.",
    en: "No processable pages were detected.",
  },
  "image resolution too low": {
    ar: "دقة الصورة منخفضة جداً للتحليل.",
    en: "Image resolution is too low for analysis.",
  },
};

export const humanizeValidationFailure = (
  error: string | undefined,
  locale: "ar" | "en",
  fallbackAr?: string,
  fallbackEn?: string
): string | null => {
  if (!error) return null;
  const normalized = error.trim().toLowerCase();
  const mapped = VALIDATION_FAILURE_MESSAGES[normalized];
  if (mapped) return locale === "ar" ? mapped.ar : mapped.en;
  if (locale === "ar" && fallbackAr) return fallbackAr;
  if (locale === "en" && fallbackEn) return fallbackEn;
  return error;
};

export type DiagnosticsSummaryStatus = "valid" | "requires_review" | "incomplete";

export const getDiagnosticsSummaryStatus = (
  extraction: InstitutionReportValidationView | null | undefined,
  diagnostics: InstitutionReportValidationDiagnostics | null | undefined
): DiagnosticsSummaryStatus => {
  if (!extraction && !diagnostics) return "incomplete";

  const reviewStatus = String(
    extraction?.validationResult?.reviewStatus || extraction?.reviewStatus || ""
  ).toUpperCase();

  if (reviewStatus === "APPROVED") return "valid";
  if (reviewStatus === "REQUIRES_REVIEW") return "requires_review";

  if (diagnostics?.ocrError || diagnostics?.visionError) return "incomplete";

  const ratingsDetected = extraction?.validationResult?.ratingsDetected ?? 0;
  const expectedRatings = extraction?.validationResult?.expectedRatings ?? 10;
  if (expectedRatings > 0 && ratingsDetected < expectedRatings) return "incomplete";

  return reviewStatus ? "requires_review" : "incomplete";
};

export const diagnosticsSummaryLabel = (
  status: DiagnosticsSummaryStatus,
  locale: "ar" | "en"
): string => {
  if (status === "valid") return locale === "ar" ? "صالح" : "Valid";
  if (status === "requires_review") return locale === "ar" ? "يحتاج مراجعة" : "Requires review";
  return locale === "ar" ? "غير مكتمل" : "Incomplete";
};

export const diagnosticsSummaryTone = (status: DiagnosticsSummaryStatus): string => {
  if (status === "valid") return SEVERITY_TONES.success;
  if (status === "requires_review") return SEVERITY_TONES.warning;
  return SEVERITY_TONES.critical;
};

export const buildConsistencyCauses = (
  intelligence: TrainingReportIntelligence | null | undefined,
  locale: "ar" | "en"
): string[] => {
  if (!intelligence) return [];

  const causes: string[] = [];

  for (const flag of intelligence.riskFlags) {
    const label = TRAINING_INTELLIGENCE_RISK_LABELS[flag]?.[locale === "ar" ? "ar" : "en"];
    if (label) causes.push(label);
  }

  for (const row of intelligence.fieldComparisons) {
    if (!row.mismatch) continue;
    const fieldLabel = locale === "ar" ? row.labelAr : row.labelEn;
    causes.push(
      locale === "ar"
        ? `عدم تطابق في ${fieldLabel}`
        : `Mismatch in ${fieldLabel}`
    );
  }

  for (const warning of intelligence.warnings) {
    if (warning.trim()) causes.push(warning.trim());
  }

  return [...new Set(causes)];
};

export const isPreviewableInstitutionReport = (fileName: string) =>
  /\.(pdf|png|jpe?g)$/i.test(fileName);

export const previewUnavailableMessage = (locale: "ar" | "en", reason?: string) => {
  if (reason) return reason;
  return locale === "ar"
    ? "تعذر إنشاء المعاينة لهذا الملف."
    : "Preview could not be generated for this file.";
};
