import { canAccessAdminPath } from "@/lib/app-role-scope-matrix";
import { isAlumniPlatformAdminRole } from "@/lib/achievement-reviewer-roles";

/**
 * Alumni platform admins are restricted to `/admin/alumni/*` (enforced also in AdminAreaGuard + route matrix).
 */
export const isAlumniAdminShellPath = (pathname: string): boolean => {
  const path = pathname.split("?")[0] || "";
  return path === "/admin/alumni" || path.startsWith("/admin/alumni/");
};

export const assertAlumniAdminMayAccessAdminPath = (role: string | null | undefined, pathname: string): boolean => {
  if (!isAlumniPlatformAdminRole(role)) return true;
  return isAlumniAdminShellPath(pathname) && canAccessAdminPath(role, pathname);
};
