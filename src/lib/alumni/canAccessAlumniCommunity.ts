import { normalizeGrade } from "@/constants/grades";
import { getAccountType, type AccountTypeUserLike } from "@/lib/account-type";

/**
 * Shared grades for Alumni Intelligence Ecosystem (community search, networking, mentorship browse, etc.).
 * Must stay aligned with academic advisor eligibility for students.
 */
export const ALUMNI_COMMUNITY_ELIGIBLE_STUDENT_GRADES_READONLY = ["g11", "g12"] as const;

const ELIGIBLE = new Set<string>(ALUMNI_COMMUNITY_ELIGIBLE_STUDENT_GRADES_READONLY);

export type AlumniCommunityEligibilityInput = {
  accountType?: AccountTypeUserLike["accountType"] | null;
  grade?: string | null;
  role?: string | null;
  /** Admin soft-remove — block alumni ecosystem access (Date or ISO string from API). */
  alumniCommunityRemovedAt?: Date | string | null;
  /** Permanent alumni data purge — block alumni ecosystem access. */
  alumniPermanentlyPurgedAt?: Date | string | null;
};

/** Student-only grade check (g11/g12 after normalize); used by advisor + community for learners. */
export const isEligibleStudentGradeForAlumniEcosystem = (grade: string | null | undefined): boolean => {
  const normalized = normalizeGrade(grade);
  if (!normalized) return false;
  return ELIGIBLE.has(normalized);
};

/**
 * CASE B: alumni accounts always have community access.
 * CASE A: students only after normalizeGrade → g11 | g12.
 * Staff / non-student roles: allowed (operations, testing; RBAC applies elsewhere).
 * Unknown / legacy / missing grade for students: denied (fail-safe).
 */
export const canAccessAlumniCommunity = (input: AlumniCommunityEligibilityInput): boolean => {
  if (getAccountType(input as AccountTypeUserLike) === "alumni") {
    if (Boolean(input.alumniCommunityRemovedAt) || Boolean(input.alumniPermanentlyPurgedAt)) return false;
    return true;
  }

  const role = String(input.role || "");
  if (role !== "student") return true;

  return isEligibleStudentGradeForAlumniEcosystem(input.grade);
};
