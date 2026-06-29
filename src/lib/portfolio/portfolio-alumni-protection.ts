export type InstitutionalRecordProtectionInput = {
  accountType?: string | null;
  studentLifecycleStatus?: string | null;
  role?: string | null;
};

/**
 * Graduated / transferred / alumni students retain permanent institutional records.
 * Additive lifecycle field is optional; accountType alumni is the primary signal today.
 */
export const isInstitutionalRecordProtectedStudent = (
  user: InstitutionalRecordProtectionInput
): boolean => {
  if (user.accountType === "alumni") return true;
  const lifecycle = String(user.studentLifecycleStatus || "").trim().toLowerCase();
  return lifecycle === "graduated" || lifecycle === "transferred" || lifecycle === "alumni";
};

export const INSTITUTIONAL_RECORD_DELETE_FORBIDDEN = "INSTITUTIONAL_RECORD_DELETE_FORBIDDEN";
export const INSTITUTIONAL_PORTFOLIO_DISABLE_FORBIDDEN = "INSTITUTIONAL_PORTFOLIO_DISABLE_FORBIDDEN";
