import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { getAccountType } from "@/lib/account-type";
import type { AuthGuardResult, AuthedUser } from "@/lib/auth-guard";

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
