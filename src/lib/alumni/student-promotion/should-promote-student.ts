import { getAccountType, type AccountTypeUserLike } from "@/lib/account-type";
import { normalizeGrade } from "./normalize-grade";

export type StudentPromotionCandidateLike = {
  role?: string | null;
  status?: string | null;
  accountType?: AccountTypeUserLike["accountType"] | null;
  grade?: string | null;
  alumniProfile?: { alumniActivationStatus?: string | null } | null;
};

/**
 * Eligible for annual g12 → alumni promotion: active student row, g12, not already alumni/promoted.
 */
export const shouldPromoteStudentToAlumni = (user: StudentPromotionCandidateLike): boolean => {
  if (String(user.role || "") !== "student") return false;
  if (String(user.status || "") !== "active") return false;
  if (getAccountType(user as AccountTypeUserLike) === "alumni") return false;

  const g = normalizeGrade(user.grade);
  if (g !== "g12") return false;

  if (user.alumniProfile?.alumniActivationStatus === "promoted_from_student") return false;

  return true;
};
