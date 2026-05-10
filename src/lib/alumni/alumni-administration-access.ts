import type { IUser } from "@/models/User";
import { PERMISSIONS } from "@/constants/permissions";
import { resolveUserPermissions } from "@/lib/requirePermission";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";

const EXTRA_ALUMNI_ADMIN_PERMS = new Set(["alumni.manage", "userManagement.delete"]);

/**
 * Alumni onboarding + moderation APIs (approve requests, soft/purge alumni community data).
 * Aligns with {@link ADMIN_ROUTE_REQUIRED_CAPABILITY} for /admin/alumni/* (userManagement)
 * plus legacy {@link PERMISSIONS.usersManage} / explicit permission strings on the user doc.
 */
export const userMayAdministerAlumni = async (user: IUser): Promise<boolean> => {
  if (String(user.role || "").toLowerCase() === "admin") return true;
  if (roleHasCapability(String(user.role), "userManagement")) return true;
  const perms = await resolveUserPermissions(user);
  if (perms.has(PERMISSIONS.usersManage)) return true;
  for (const p of EXTRA_ALUMNI_ADMIN_PERMS) {
    if (perms.has(p)) return true;
  }
  return false;
};
