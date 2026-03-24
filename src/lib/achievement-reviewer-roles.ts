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
