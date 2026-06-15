export const APPLICATION_REQUIREMENT_TYPES = ["general", "parent_consent"] as const;
export type ApplicationRequirementType = (typeof APPLICATION_REQUIREMENT_TYPES)[number];

export const PARENT_CONSENT_REQUIREMENT_TYPE = "parent_consent" as const;

export const PARENT_CONSENT_DEFAULT_TITLE = {
  ar: "موافقة ولي الأمر",
  en: "Parent/guardian consent",
} as const;

export const PARENT_CONSENT_DEFAULT_DESCRIPTION = {
  ar: "يرجى رفع نموذج موافقة ولي الأمر موقعاً قبل استكمال إجراءات القبول النهائي.",
  en: "Please upload a signed parent/guardian consent form before final acceptance can be completed.",
} as const;

export const PARENT_CONSENT_ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"] as const;

export const PARENT_CONSENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
] as const;

export const PARENT_CONSENT_TIMELINE_ACTIONS = {
  requested: "parent_consent_requested",
  uploaded: "parent_consent_uploaded",
  aiVerified: "parent_consent_ai_verified",
  approved: "parent_consent_approved",
  rejected: "parent_consent_rejected",
} as const;

export const PARENT_CONSENT_DISPLAY_STATUSES = [
  "not_required",
  "required",
  "uploaded",
  "approved",
  "rejected",
] as const;

export type ParentConsentDisplayStatus = (typeof PARENT_CONSENT_DISPLAY_STATUSES)[number];

export const PARENT_CONSENT_DISPLAY_LABELS: Record<
  ParentConsentDisplayStatus,
  { ar: string; en: string }
> = {
  not_required: { ar: "غير مطلوبة", en: "Not required" },
  required: { ar: "مطلوبة", en: "Required" },
  uploaded: { ar: "تم الرفع", en: "Uploaded" },
  approved: { ar: "تم الاعتماد", en: "Approved" },
  rejected: { ar: "مرفوضة", en: "Rejected" },
};

export const PARENT_CONSENT_ACCEPTANCE_BLOCKED_AR =
  "لا يمكن اعتماد الطالب قبل رفع موافقة ولي الأمر.";

export const PARENT_CONSENT_ACCEPTANCE_BLOCKED_EN =
  "The student cannot be accepted until parent/guardian consent is uploaded.";

export const PARENT_CONSENT_REVIEW_PENDING_AR =
  "لا يمكن اعتماد الطالب قبل اعتماد موافقة ولي الأمر.";

export const PARENT_CONSENT_REVIEW_PENDING_EN =
  "The student cannot be accepted until parent/guardian consent is approved.";

export const isParentConsentFileAllowed = (fileName: string, mimeType?: string): boolean => {
  const name = fileName.toLowerCase();
  const extOk = PARENT_CONSENT_ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (extOk) return true;
  const mime = (mimeType || "").toLowerCase();
  return PARENT_CONSENT_ALLOWED_MIME_TYPES.includes(mime as (typeof PARENT_CONSENT_ALLOWED_MIME_TYPES)[number]);
};

export const mapRequirementToParentConsentDisplay = (
  row: { requirementType?: string; status: string; required?: boolean } | null
): ParentConsentDisplayStatus => {
  if (!row || row.requirementType !== PARENT_CONSENT_REQUIREMENT_TYPE) return "not_required";
  if (row.status === "accepted" || row.status === "waived") return "approved";
  if (row.status === "rejected") return "rejected";
  if (row.status === "submitted") return "uploaded";
  return "required";
};
