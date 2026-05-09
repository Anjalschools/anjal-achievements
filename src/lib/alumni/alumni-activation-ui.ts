/**
 * Shared activation / onboarding labels for admin UI (Arabic + English).
 */
export const ALUMNI_ACTIVATION_STATUS_VALUES = [
  "pending",
  "created_new",
  "linked_existing",
  "activation_sent",
  "promoted_from_student",
  "onboarding_required",
  "active",
  "failed",
] as const;

export type AlumniActivationUiStatus = (typeof ALUMNI_ACTIVATION_STATUS_VALUES)[number];

export const isAlumniActivationUiStatus = (v: string | null | undefined): v is AlumniActivationUiStatus =>
  Boolean(v && (ALUMNI_ACTIVATION_STATUS_VALUES as readonly string[]).includes(String(v)));

export const alumniActivationStatusBadgeClass = (status: string): string => {
  switch (status) {
    case "pending":
      return "bg-slate-100 text-slate-800 ring-slate-200";
    case "created_new":
      return "bg-sky-50 text-sky-900 ring-sky-200";
    case "linked_existing":
      return "bg-indigo-50 text-indigo-900 ring-indigo-200";
    case "activation_sent":
      return "bg-cyan-50 text-cyan-900 ring-cyan-200";
    case "promoted_from_student":
      return "bg-violet-50 text-violet-900 ring-violet-200";
    case "onboarding_required":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "active":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "failed":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-gray-50 text-gray-700 ring-gray-200";
  }
};

export const alumniActivationStatusLabel = (status: string | null | undefined, isAr: boolean): string => {
  const s = String(status || "").trim() || "—";
  if (isAr) {
    const ar: Record<string, string> = {
      pending: "قيد الانتظار",
      created_new: "حساب جديد",
      linked_existing: "مرتبط بحساب موجود",
      activation_sent: "أُرسلت رسالة التفعيل",
      promoted_from_student: "محوّل من طالب",
      onboarding_required: "يحتاج استكمال البيانات",
      active: "نشط",
      failed: "فشل التفعيل",
    };
    return ar[s] || s;
  }
  const en: Record<string, string> = {
    pending: "Pending",
    created_new: "New account",
    linked_existing: "Linked existing",
    activation_sent: "Activation email sent",
    promoted_from_student: "Promoted from student",
    onboarding_required: "Onboarding required",
    active: "Active",
    failed: "Failed",
  };
  return en[s] || s;
};

/** Derive display status for admin table (onboarding flag overrides for clarity). */
export const resolveAlumniActivationDisplayStatus = (
  stored: string | null | undefined,
  needsOnboarding?: boolean | null
): string => {
  if (needsOnboarding) return "onboarding_required";
  return String(stored || "").trim() || "pending";
};
