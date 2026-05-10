import { NextResponse } from "next/server";
import type { IUser } from "@/models/User";
import { requireRole, requireSession, type AuthGuardResult, type AuthedUser } from "@/lib/auth-guard";
import { userMayAdministerAlumni } from "@/lib/alumni/alumni-administration-access";

export type AdminUserManager = AuthedUser;

export type AdminUserManagementGate = AuthGuardResult;

/** Full user CRUD: platform admin only (supervisors use scoped review tools, not global user admin). */
export async function requireAdminUserManager(): Promise<AuthGuardResult> {
  return requireRole(undefined, ["admin"]);
}

/**
 * Alumni onboarding list + alumni community moderation (soft remove / permanent purge).
 * Matches `userManagement` capability and `users.manage` permission (see role / access matrix).
 */
export async function requireAlumniAdministrationActor(): Promise<AuthGuardResult> {
  const gate = await requireSession(undefined);
  if (!gate.ok) return gate;
  const allowed = await userMayAdministerAlumni(gate.user as unknown as IUser);
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "FORBIDDEN",
          reason: "Missing userManagement capability or users.manage / alumni.manage permission",
        },
        { status: 403 }
      ),
    };
  }
  return gate;
}
