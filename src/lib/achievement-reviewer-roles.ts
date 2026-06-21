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

/** Dedicated summer training & partnerships administration (no achievements platform access). */
export const PARTNERSHIP_SUPERVISOR_ROLE = "partnershipSupervisor" as const;

export const isPartnershipSupervisorRole = (role: string | undefined | null): boolean =>
  String(role || "").trim() === PARTNERSHIP_SUPERVISOR_ROLE;

/** Admin routes partnership supervisors may open (training module + academic years read). */
export const PARTNERSHIP_SUPERVISOR_ADMIN_PREFIXES = [
  "/admin/partnerships",
  "/admin/academic-years",
] as const;

export const isPartnershipSupervisorAllowedAdminPath = (pathname: string): boolean => {
  const path = String(pathname || "").split("?")[0] || "";
  return PARTNERSHIP_SUPERVISOR_ADMIN_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
};

/** Training institution portal users (Model B). */
export const TRAINING_INSTITUTION_ROLE = "trainingInstitution" as const;

export const isTrainingInstitutionRole = (role: string | undefined | null): boolean =>
  String(role || "").trim() === TRAINING_INSTITUTION_ROLE;

/** May load the `/admin` App Router shell (achievements staff OR alumni-only OR partnerships-only admins). */
export const isAdminShellRole = (role: string | undefined | null): boolean =>
  isAchievementReviewerRole(role) ||
  isAlumniPlatformAdminRole(role) ||
  isPartnershipSupervisorRole(role);
