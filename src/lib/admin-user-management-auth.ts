import { requireRole, type AuthGuardResult, type AuthedUser } from "@/lib/auth-guard";

export type AdminUserManager = AuthedUser;

export type AdminUserManagementGate = AuthGuardResult;

/** Full user CRUD: platform admin or supervisor only (not judges/teachers on review duty). */
export async function requireAdminUserManager(): Promise<AuthGuardResult> {
  return requireRole(undefined, ["admin", "supervisor"]);
}
