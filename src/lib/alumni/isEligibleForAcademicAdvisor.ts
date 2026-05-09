import { normalizeGrade } from "@/constants/grades";
import { getAccountType, type AccountTypeUserLike } from "@/lib/account-type";

/**
 * Secondary grades that may access the in-platform academic advisor (ثاني ثانوي، ثالث ثانوي).
 * Central definition — do not duplicate magic grade strings in components.
 */
export const ACADEMIC_ADVISOR_ELIGIBLE_STUDENT_GRADES_READONLY = ["g11", "g12"] as const;

const ELIGIBLE = new Set<string>(ACADEMIC_ADVISOR_ELIGIBLE_STUDENT_GRADES_READONLY);

export type AcademicAdvisorEligibilityInput = {
  accountType?: AccountTypeUserLike["accountType"] | null;
  grade?: string | null;
  role?: string | null;
};

/**
 * Alumni / graduate accounts always qualify. For students, requires normalized grade g11 or g12.
 * Missing or non-normalizable grade → not eligible (defensive default).
 */
export const isEligibleForAcademicAdvisor = (input: AcademicAdvisorEligibilityInput): boolean => {
  if (getAccountType(input as AccountTypeUserLike) === "alumni") return true;

  const role = String(input.role || "");
  if (role !== "student") return false;

  const normalized = normalizeGrade(input.grade);
  if (!normalized) return false;

  return ELIGIBLE.has(normalized);
};
