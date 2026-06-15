import { createHash } from "crypto";
import { computeBufferContentFingerprint } from "@/lib/document-content-fingerprint";

export const PARENT_CONSENT_TEMPLATE_VERSION_TIMELINE_ACTIONS = {
  regenerated: "parent_consent_template_regenerated",
  outdatedDetected: "parent_consent_template_outdated_detected",
} as const;

export type ParentConsentTemplateSnapshot = {
  organizationName: string;
  opportunityTitle: string;
  trainingStartDate: string;
  trainingEndDate: string;
  trainingHours: number;
  academicYear: string;
};

export type ParentConsentTemplateVersionStatus = "current" | "minor_changes" | "outdated";

export type ParentConsentTemplateFieldComparison = {
  field: keyof ParentConsentTemplateSnapshot;
  templateValue: string;
  currentValue: string;
  changed: boolean;
  substantive: boolean;
};

export type ParentConsentTemplateVersionValidation = {
  status: ParentConsentTemplateVersionStatus;
  templateVersion: number;
  templateDataHash: string;
  currentDataHash: string;
  comparisons: ParentConsentTemplateFieldComparison[];
  originalScore: number;
  adjustedScore: number;
  scoreAdjusted: boolean;
  staleDetected: boolean;
  checkedAt: string;
};

export const PARENT_CONSENT_TEMPLATE_VERSION_STATUS_LABELS: Record<
  ParentConsentTemplateVersionStatus,
  { ar: string; en: string; icon: string }
> = {
  current: { ar: "النموذج الحالي", en: "Current template", icon: "🟢" },
  minor_changes: { ar: "توجد اختلافات بسيطة", en: "Minor differences", icon: "🟡" },
  outdated: { ar: "النموذج أقدم من بيانات الفرصة الحالية", en: "Template older than current opportunity", icon: "🔴" },
};

export const PARENT_CONSENT_STALE_TEMPLATE_MESSAGE = {
  ar: "تم اكتشاف أن نموذج الموافقة تم إنشاؤه قبل آخر تعديل للفرصة التدريبية.\n\nيرجى مراجعة مشرف الشراكات أو إعادة تحميل النموذج الأحدث.",
  en: "The consent form was created before the latest training opportunity update.\n\nPlease contact the partnership supervisor or download the latest form.",
};

const normalizeText = (value: string): string =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[،,.؛;:\-–—_]/g, " ")
    .replace(/\s+/g, " ");

const normalizeDate = (value: string): string => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return raw;
  return parsed.toISOString().slice(0, 10);
};

export const computeTrainingHoursNumber = (start?: Date | string | null, end?: Date | string | null): number => {
  if (!start || !end) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  const days = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
  return days * 6;
};

export const buildTemplateDataHash = (snapshot: ParentConsentTemplateSnapshot): string => {
  const canonical = [
    normalizeText(snapshot.organizationName),
    normalizeText(snapshot.opportunityTitle),
    normalizeDate(snapshot.trainingStartDate),
    normalizeDate(snapshot.trainingEndDate),
    String(snapshot.trainingHours),
    normalizeText(snapshot.academicYear),
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
};

export const computeTemplateFingerprint = (pdfBuffer: Buffer): string =>
  computeBufferContentFingerprint(pdfBuffer);

const SUBSTANTIVE_FIELDS: Array<keyof ParentConsentTemplateSnapshot> = [
  "organizationName",
  "opportunityTitle",
  "trainingStartDate",
  "trainingEndDate",
  "trainingHours",
  "academicYear",
];

const isTextMinorDifference = (templateValue: string, currentValue: string): boolean => {
  const t = normalizeText(templateValue);
  const c = normalizeText(currentValue);
  if (t === c) return true;
  if (!t || !c) return false;
  return t.includes(c) || c.includes(t);
};

const formatFieldValue = (field: keyof ParentConsentTemplateSnapshot, value: string | number): string => {
  if (field === "trainingHours") return String(value);
  return String(value || "—");
};

export const compareTemplateSnapshots = (
  templateSnapshot: ParentConsentTemplateSnapshot,
  currentSnapshot: ParentConsentTemplateSnapshot
): ParentConsentTemplateFieldComparison[] =>
  SUBSTANTIVE_FIELDS.map((field) => {
    const templateValue = formatFieldValue(field, templateSnapshot[field]);
    const currentValue = formatFieldValue(field, currentSnapshot[field]);
    let changed = false;
    if (field === "trainingHours") {
      changed = Number(templateSnapshot.trainingHours) !== Number(currentSnapshot.trainingHours);
    } else if (field === "trainingStartDate" || field === "trainingEndDate") {
      changed = normalizeDate(templateSnapshot[field]) !== normalizeDate(currentSnapshot[field]);
    } else {
      changed = normalizeText(templateSnapshot[field]) !== normalizeText(currentSnapshot[field]);
    }
    const substantive =
      changed &&
      (field === "trainingStartDate" ||
        field === "trainingEndDate" ||
        field === "trainingHours" ||
        field === "academicYear" ||
        (field === "organizationName" && !isTextMinorDifference(templateSnapshot[field], currentSnapshot[field])) ||
        (field === "opportunityTitle" && !isTextMinorDifference(templateSnapshot[field], currentSnapshot[field])));
    return { field, templateValue, currentValue, changed, substantive };
  });

export const resolveTemplateVersionStatus = (
  comparisons: ParentConsentTemplateFieldComparison[]
): ParentConsentTemplateVersionStatus => {
  const changed = comparisons.filter((row) => row.changed);
  if (changed.length === 0) return "current";
  const substantive = changed.filter((row) => row.substantive);
  if (substantive.length > 0) return "outdated";
  return "minor_changes";
};

export const adjustVerificationScoreForTemplateVersion = (
  originalScore: number,
  status: ParentConsentTemplateVersionStatus
): { adjustedScore: number; scoreAdjusted: boolean } => {
  if (status !== "outdated") {
    return { adjustedScore: originalScore, scoreAdjusted: false };
  }
  const adjustedScore = Math.max(0, originalScore - 20);
  return { adjustedScore, scoreAdjusted: adjustedScore !== originalScore };
};

export const validateParentConsentTemplateVersion = (input: {
  templateSnapshot: ParentConsentTemplateSnapshot;
  currentSnapshot: ParentConsentTemplateSnapshot;
  templateVersion: number;
  templateDataHash: string;
  verificationScore: number;
}): ParentConsentTemplateVersionValidation => {
  const comparisons = compareTemplateSnapshots(input.templateSnapshot, input.currentSnapshot);
  const status = resolveTemplateVersionStatus(comparisons);
  const currentDataHash = buildTemplateDataHash(input.currentSnapshot);
  const { adjustedScore, scoreAdjusted } = adjustVerificationScoreForTemplateVersion(
    input.verificationScore,
    status
  );

  return {
    status,
    templateVersion: input.templateVersion,
    templateDataHash: input.templateDataHash,
    currentDataHash,
    comparisons: comparisons.filter((row) => row.changed),
    originalScore: input.verificationScore,
    adjustedScore,
    scoreAdjusted,
    staleDetected: status === "outdated",
    checkedAt: new Date().toISOString(),
  };
};

export const isOpportunityDataStaleForTemplate = (input: {
  templateDataHash: string;
  currentDataHash: string;
}): boolean => input.templateDataHash !== input.currentDataHash;
