import { isAlumniPlatformAdminRole } from "@/lib/achievement-reviewer-roles";

export { isAlumniPlatformAdminRole };

export const assertAlumniPlatformAdminRole = (role: string | null | undefined): boolean =>
  isAlumniPlatformAdminRole(role);
