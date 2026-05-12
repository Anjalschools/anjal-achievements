import type { IUser } from "@/models/User";
import { PERMISSIONS } from "@/constants/permissions";
import { resolveUserPermissions } from "@/lib/requirePermission";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { isAlumniPlatformAdminRole } from "@/lib/achievement-reviewer-roles";

const EXTRA_ALUMNI_ADMIN_PERMS = new Set(["alumni.manage", "userManagement.delete"]);

/**
 * Alumni onboarding + moderation APIs (approve requests, soft/purge alumni community data).
 * Platform admin, legacy `userManagement` staff, explicit permissions, **or** the dedicated `alumniAdmin` role.
 */
export const userMayAdministerAlumni = async (user: IUser): Promise<boolean> => {
  const role = String(user.role || "").toLowerCase();
  if (role === "admin") return true;
  if (isAlumniPlatformAdminRole(user.role)) return true;
  if (roleHasCapability(String(user.role), "userManagement")) return true;
  if (roleHasCapability(String(user.role), "alumniManagement")) return true;
  const perms = await resolveUserPermissions(user);
  if (perms.has(PERMISSIONS.usersManage)) return true;
  for (const p of EXTRA_ALUMNI_ADMIN_PERMS) {
    if (perms.has(p)) return true;
  }
  return false;
};
