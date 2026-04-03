import { requireRole, type AuthGuardResult, type AuthedUser } from "@/lib/auth-guard";

export type AdminUserManager = AuthedUser;

export type AdminUserManagementGate = AuthGuardResult;

/** Full user CRUD: platform admin only (supervisors use scoped review tools, not global user admin). */
export async function requireAdminUserManager(): Promise<AuthGuardResult> {
  return requireRole(undefined, ["admin"]);
}
