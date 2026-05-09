import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { getAccountType } from "@/lib/account-type";
import type { AuthGuardResult, AuthedUser } from "@/lib/auth-guard";
import { isEligibleForAcademicAdvisor } from "@/lib/alumni/isEligibleForAcademicAdvisor";

export type AlumniGuardResult =
  | { ok: true; user: AuthedUser; userId: string }
  | { ok: false; response: NextResponse };

export const requireAlumniUser = async (_request?: NextRequest): Promise<AlumniGuardResult> => {
  const user = await getCurrentDbUser();
  if (!user?._id) {
    return { ok: false, response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }
  if (getAccountType(user as any) !== "alumni") {
    return { ok: false, response: NextResponse.json({ error: "ALUMNI_ONLY" }, { status: 403 }) };
  }
  return { ok: true, user: user as AuthedUser, userId: String(user._id) };
};

/** Authenticated session (student or alumni) — for mentorship requests from students. */
export const requireSessionUser = async (): Promise<AuthGuardResult> => {
  const user = await getCurrentDbUser();
  if (!user?._id) {
    return { ok: false, response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }
  return { ok: true, user: user as AuthedUser };
};

/** Student (g11–g12) or alumni — for in-platform academic advisor APIs. */
export const requireAcademicAdvisorEligibleSession = async (): Promise<AuthGuardResult> => {
  const gate = await requireSessionUser();
  if (!gate.ok) return gate;
  const u = gate.user as unknown as { role?: string; accountType?: string; grade?: string };
  if (
    !isEligibleForAcademicAdvisor({
      accountType: u.accountType as "student" | "alumni" | null | undefined,
      grade: u.grade,
      role: u.role,
    })
  ) {
    return {
      ok: false,
      response: NextResponse.json({ error: "ACADEMIC_ADVISOR_NOT_ELIGIBLE" }, { status: 403 }),
    };
  }
  return gate;
};
