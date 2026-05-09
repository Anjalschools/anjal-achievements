import { getAccountType, type AccountTypeUserLike } from "@/lib/account-type";
import {
  ALUMNI_COMMUNITY_ELIGIBLE_STUDENT_GRADES_READONLY,
  isEligibleStudentGradeForAlumniEcosystem,
  type AlumniCommunityEligibilityInput,
} from "@/lib/alumni/canAccessAlumniCommunity";

/** @deprecated Use ALUMNI_COMMUNITY_ELIGIBLE_STUDENT_GRADES_READONLY — kept for imports stability */
export const ACADEMIC_ADVISOR_ELIGIBLE_STUDENT_GRADES_READONLY =
  ALUMNI_COMMUNITY_ELIGIBLE_STUDENT_GRADES_READONLY;

export type AcademicAdvisorEligibilityInput = AlumniCommunityEligibilityInput;

/**
 * Alumni qualify; students only g11/g12; staff/other roles do not use the student advisor UI.
 */
export const isEligibleForAcademicAdvisor = (input: AcademicAdvisorEligibilityInput): boolean => {
  if (getAccountType(input as AccountTypeUserLike) === "alumni") return true;
  if (String(input.role || "") !== "student") return false;
  return isEligibleStudentGradeForAlumniEcosystem(input.grade);
};
