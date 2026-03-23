export const ADMIN_MANAGEABLE_ROLES = [
  "student",
  "admin",
  "teacher",
  "supervisor",
  "judge",
  "schoolAdmin",
] as const;

export type AdminManageableRole = (typeof ADMIN_MANAGEABLE_ROLES)[number];

export const isAdminManageableRole = (v: string): v is AdminManageableRole =>
  (ADMIN_MANAGEABLE_ROLES as readonly string[]).includes(v);
