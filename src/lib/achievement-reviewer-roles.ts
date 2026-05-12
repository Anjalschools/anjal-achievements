/**
 * Roles allowed to use reviewer/admin achievement APIs.
 * Client-safe (no server-only imports).
 */
export const ACHIEVEMENT_REVIEWER_ROLES_LIST = [
  "admin",
  "supervisor",
  "schoolAdmin",
  "teacher",
  "judge",
] as const;

const REVIEWER_SET = new Set<string>(ACHIEVEMENT_REVIEWER_ROLES_LIST);

export const isAchievementReviewerRole = (role: string | undefined | null): boolean =>
  REVIEWER_SET.has(String(role || ""));

/** Dedicated alumni community administration (no achievements platform access). */
export const ALUMNI_PLATFORM_ADMIN_ROLE = "alumniAdmin" as const;

export const isAlumniPlatformAdminRole = (role: string | undefined | null): boolean =>
  String(role || "").trim().toLowerCase() === String(ALUMNI_PLATFORM_ADMIN_ROLE).toLowerCase();

/** May load the `/admin` App Router shell (achievements staff OR alumni-only admins). */
export const isAdminShellRole = (role: string | undefined | null): boolean =>
  isAchievementReviewerRole(role) || isAlumniPlatformAdminRole(role);
