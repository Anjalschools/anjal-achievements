/**
 * Client-safe navigation role helpers (sidebar, menus).
 * Admin manager = platform operators who can manage users, audit, platform settings.
 */
import { isAchievementReviewerRole } from "@/lib/achievement-reviewer-roles";

export const ADMIN_MANAGER_ROLES = ["admin", "supervisor"] as const;

export const isAdminManagerRole = (role: string | null | undefined): boolean =>
  role === "admin" || role === "supervisor";

/** Reviewer / staff who use admin achievement flows but not necessarily user management. */
export { isAchievementReviewerRole as isReviewerNavRole };
