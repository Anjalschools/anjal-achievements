export const ADMINISTRATIVELY_CANCELLED_STATUS = "administratively_cancelled" as const;

export const ADMIN_TRAINING_CANCEL_TIMELINE_ACTION =
  "training_application_administratively_cancelled" as const;

export const ADMIN_TRAINING_CANCEL_AUDIT_ACTION = "training_application_admin_cancelled" as const;

export const ADMIN_TRAINING_CANCEL_REASONS = [
  { code: "unsuitable_opportunity", ar: "اختيار فرصة غير مناسبة", en: "Unsuitable opportunity" },
  { code: "administrative_error", ar: "خطأ إداري", en: "Administrative error" },
  { code: "student_preference_change", ar: "تغيير رغبة الطالب", en: "Student preference change" },
  { code: "transfer_institution", ar: "نقل إلى مؤسسة أخرى", en: "Transfer to another institution" },
  { code: "admin_request", ar: "إلغاء بطلب من الإدارة", en: "Cancelled per administration request" },
  { code: "other", ar: "سبب آخر", en: "Other" },
] as const;

export type AdminTrainingCancelReasonCode = (typeof ADMIN_TRAINING_CANCEL_REASONS)[number]["code"];

export const INSTITUTION_ADMIN_CANCELLED_MESSAGE = {
  ar: "تم إلغاء الطلب من قبل إدارة المدرسة",
  en: "This application was cancelled by school administration",
};

export const ADMIN_TRAINING_CANCEL_BLOCKED_MESSAGE = {
  ar: "لا يمكن إلغاء طلب مكتمل نتج عنه إنجاز أو شهادة.",
  en: "Cannot cancel a completed application that produced an achievement or certificate.",
};

export const canAdminCancelTrainingApplication = (status: string): boolean =>
  !isAdministrativelyCancelledApplication(status) && status !== "completed";

export const isAdministrativelyCancelledApplication = (status: string | null | undefined): boolean =>
  String(status || "").trim() === ADMINISTRATIVELY_CANCELLED_STATUS;

export const resolveAdminCancelReasonLabel = (
  code: string,
  note: string | undefined,
  isAr: boolean
): string => {
  const preset = ADMIN_TRAINING_CANCEL_REASONS.find((row) => row.code === code);
  const base = preset ? (isAr ? preset.ar : preset.en) : code;
  const extra = String(note || "").trim();
  if (code === "other" && extra) return extra;
  if (extra && code !== "other") return `${base} — ${extra}`;
  return base;
};
