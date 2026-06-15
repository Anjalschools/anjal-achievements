export const PARENT_CONSENT_AI_TIMELINE_ACTION = "parent_consent_ai_verified" as const;

export const PARENT_CONSENT_POSITIVE_SIGNALS = [
  "موافقة",
  "ولي الأمر",
  "ولي الامر",
  "الوصي",
  "الطالب",
  "الطالبة",
  "التدريب",
  "التوقيع",
  "أوافق",
  "اوافق",
  "parent",
  "guardian",
  "consent",
  "training",
  "signature",
  "student",
] as const;

export const PARENT_CONSENT_NEGATIVE_SIGNALS = [
  "فاتورة",
  "invoice",
  "receipt",
  "إيصال",
  "شهادة",
  "certificate",
  "diploma",
  "كشف حساب",
  "statement",
  "bill",
] as const;

export type ParentConsentConfidenceBand = "very_trusted" | "needs_human_review" | "reviewer_alert";

export type ParentConsentVerificationClassification =
  | "likely_parent_consent"
  | "unclear"
  | "unlikely_parent_consent";

export type ParentConsentOcrExtract = {
  rawText: string;
  extractedName: string | null;
  extractedDate: string | null;
  extractedIdNumber: string | null;
  signatureHint: string | null;
  ocrReliability: "high" | "medium" | "low";
};

export type ParentConsentAiVerification = {
  verificationScore: number;
  confidenceBand: ParentConsentConfidenceBand;
  classification: ParentConsentVerificationClassification;
  positiveSignals: string[];
  negativeSignals: string[];
  summaryAr: string;
  summaryEn: string;
  verificationSummary?: string;
  verifiedAt: string;
  duplicateDetected: boolean;
  documentFingerprint: string;
  ocr: ParentConsentOcrExtract;
  fieldChecks?: import("@/lib/partnerships/parent-consent-template-constants").ParentConsentFieldChecks;
  studentCheckStatus?: import("@/lib/partnerships/parent-consent-template-constants").ParentConsentStudentCheckStatus;
  templateVersionValidation?: import("@/lib/partnerships/parent-consent-template-version").ParentConsentTemplateVersionValidation;
  runStatus: "completed" | "failed" | "skipped";
  aiAssisted?: boolean;
};

export const resolveParentConsentConfidenceBand = (score: number): ParentConsentConfidenceBand => {
  if (score >= 90) return "very_trusted";
  if (score >= 70) return "needs_human_review";
  return "reviewer_alert";
};

export const PARENT_CONSENT_CONFIDENCE_BAND_LABELS: Record<
  ParentConsentConfidenceBand,
  { ar: string; en: string }
> = {
  very_trusted: { ar: "موثوق جداً", en: "Very trusted" },
  needs_human_review: { ar: "يحتاج مراجعة بشرية", en: "Needs human review" },
  reviewer_alert: { ar: "تنبيه للمراجع", en: "Reviewer alert" },
};

export const PARENT_CONSENT_CLASSIFICATION_LABELS: Record<
  ParentConsentVerificationClassification,
  { ar: string; en: string }
> = {
  likely_parent_consent: { ar: "موافقة ولي أمر محتملة", en: "Likely parent consent" },
  unclear: { ar: "غير واضح", en: "Unclear" },
  unlikely_parent_consent: { ar: "غير محتمل كموافقة", en: "Unlikely parent consent" },
};
