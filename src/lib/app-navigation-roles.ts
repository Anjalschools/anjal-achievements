/**
 * Client-safe navigation role helpers (sidebar, menus).
 * Admin manager = platform operators who can manage users (full admin only; supervisors are scoped reviewers).
 */
import {
  isAchievementReviewerRole,
  isAlumniPlatformAdminRole,
  isAdminShellRole,
  isPartnershipSupervisorRole,
  isTrainingInstitutionRole,
} from "@/lib/achievement-reviewer-roles";

export const ADMIN_MANAGER_ROLES = ["admin"] as const;

export const isAdminManagerRole = (role: string | null | undefined): boolean => role === "admin";

/** Reviewer / staff who use admin achievement flows but not necessarily user management. */
export { isAchievementReviewerRole as isReviewerNavRole };

/** Anyone who should see the staff-style sidebar (achievements admin area OR alumni-only admins). */
export { isAdminShellRole as isStaffAdminNavRole };

export { isAlumniPlatformAdminRole, isPartnershipSupervisorRole, isTrainingInstitutionRole };
