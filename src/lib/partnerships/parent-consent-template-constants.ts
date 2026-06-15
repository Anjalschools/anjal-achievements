import { PARENT_CONSENT_STALE_TEMPLATE_MESSAGE } from "@/lib/partnerships/parent-consent-template-version";

export const PARENT_CONSENT_TEMPLATE_TIMELINE_ACTIONS = {
  generated: "parent_consent_template_generated",
  downloaded: "parent_consent_downloaded",
  regenerated: "parent_consent_template_regenerated",
  outdatedDetected: "parent_consent_template_outdated_detected",
} as const;

export type ParentConsentTemplateSnapshot = import("@/lib/partnerships/parent-consent-template-version").ParentConsentTemplateSnapshot;

export type ParentConsentTemplateContext = {
  studentName: string;
  studentNationalId: string;
  grade: string;
  school: string;
  organizationName: string;
  opportunityTitle: string;
  trainingPeriod: string;
  trainingHours: string;
  trainingProvider: string;
  applicationNumber: string;
  generatedAt: string;
};

export type ParentConsentGeneratedTemplate = {
  attachmentId: string;
  storageKey: string;
  fileName: string;
  generatedAt: string;
  templateVersion: number;
  templateGeneratedAt: string;
  templateFingerprint: string;
  templateDataHash: string;
  templateSnapshot: ParentConsentTemplateSnapshot;
  context: ParentConsentTemplateContext;
};

export type ParentConsentTemplateVersionHistoryEntry = Pick<
  ParentConsentGeneratedTemplate,
  | "attachmentId"
  | "storageKey"
  | "fileName"
  | "generatedAt"
  | "templateVersion"
  | "templateGeneratedAt"
  | "templateFingerprint"
  | "templateDataHash"
  | "templateSnapshot"
>;

export type ParentConsentFieldChecks = {
  studentName: boolean;
  organizationName: boolean;
  opportunityTitle: boolean;
  guardianDetails: boolean;
  signature: boolean;
  date: boolean;
};

export type ParentConsentStudentCheckStatus =
  | "not_started"
  | "checking"
  | "verified_pending_review"
  | "needs_reupload";

export const PARENT_CONSENT_STUDENT_CHECK_STATUS_LABELS: Record<
  ParentConsentStudentCheckStatus,
  { ar: string; en: string }
> = {
  not_started: { ar: "لم يبدأ الفحص", en: "Not started" },
  checking: { ar: "قيد الفحص", en: "Checking" },
  verified_pending_review: { ar: "تم التحقق مبدئياً", en: "Preliminarily verified" },
  needs_reupload: { ar: "يحتاج إعادة رفع", en: "Needs re-upload" },
};

export const sanitizeParentConsentAiVerificationForStudent = (
  verification: import("@/lib/partnerships/parent-consent-verification-constants").ParentConsentAiVerification | null | undefined
) => {
  if (!verification) return null;
  return {
    verificationScore: verification.verificationScore,
    classification: verification.classification,
    studentCheckStatus: verification.studentCheckStatus,
    verificationSummary: verification.verificationSummary,
    summaryAr: verification.summaryAr,
    summaryEn: verification.summaryEn,
    fieldChecks: verification.fieldChecks,
    duplicateDetected: verification.duplicateDetected,
    runStatus: verification.runStatus,
    templateVersionStatus: verification.templateVersionValidation?.status,
    staleTemplateDetected: verification.templateVersionValidation?.staleDetected ?? false,
    staleTemplateMessageAr: verification.templateVersionValidation?.staleDetected
      ? PARENT_CONSENT_STALE_TEMPLATE_MESSAGE.ar
      : undefined,
    staleTemplateMessageEn: verification.templateVersionValidation?.staleDetected
      ? PARENT_CONSENT_STALE_TEMPLATE_MESSAGE.en
      : undefined,
  };
};

export const buildParentConsentVerificationSummary = (
  checks: ParentConsentFieldChecks,
  score: number,
  isAr: boolean
): string => {
  const mark = (ok: boolean) => (ok ? "✓" : "✗");
  const lines = isAr
    ? [
        `${mark(checks.studentName)} اسم الطالب`,
        `${mark(checks.organizationName)} اسم المؤسسة`,
        `${mark(checks.opportunityTitle)} اسم الفرصة`,
        `${mark(checks.guardianDetails)} بيانات ولي الأمر`,
        `${mark(checks.signature)} التوقيع`,
        `${mark(checks.date)} التاريخ`,
        `درجة الثقة: ${score}%`,
      ]
    : [
        `${mark(checks.studentName)} Student name`,
        `${mark(checks.organizationName)} Organization`,
        `${mark(checks.opportunityTitle)} Opportunity`,
        `${mark(checks.guardianDetails)} Guardian details`,
        `${mark(checks.signature)} Signature`,
        `${mark(checks.date)} Date`,
        `Confidence: ${score}%`,
      ];
  return lines.join("\n");
};
