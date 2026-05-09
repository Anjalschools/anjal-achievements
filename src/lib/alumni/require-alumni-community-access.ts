import "server-only";
import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import type { AuthedUser } from "@/lib/auth-guard";
import { canAccessAlumniCommunity } from "@/lib/alumni/canAccessAlumniCommunity";

const forbidden = () => NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

export type CommunityAccessGate =
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getCurrentDbUser>>> }
  | { ok: false; response: NextResponse };

/**
 * Requires authenticated user eligible for Alumni Intelligence Ecosystem (see {@link canAccessAlumniCommunity}).
 * Anonymous requests receive 403 without body details (no enumeration).
 */
export const requireAlumniCommunityAccess = async (): Promise<CommunityAccessGate> => {
  const user = await getCurrentDbUser();
  if (!user?._id) {
    return { ok: false, response: forbidden() };
  }
  const u = user as {
    role?: string;
    accountType?: string;
    grade?: string;
    alumniCommunityRemovedAt?: Date | null;
    alumniPermanentlyPurgedAt?: Date | null;
  };
  if (
    !canAccessAlumniCommunity({
      accountType: u.accountType as "student" | "alumni" | null | undefined,
      grade: u.grade,
      role: u.role,
      alumniCommunityRemovedAt: u.alumniCommunityRemovedAt,
      alumniPermanentlyPurgedAt: u.alumniPermanentlyPurgedAt,
    })
  ) {
    return { ok: false, response: forbidden() };
  }
  return { ok: true, user };
};

/** Use after `requireSessionUser` to avoid a second DB round-trip. */
export const requireAlumniCommunityForAuthedUser = (
  user: AuthedUser | null | undefined
): NextResponse | null => {
  if (!user) return forbidden();
  const u = user as {
    role?: string;
    accountType?: string;
    grade?: string;
    alumniCommunityRemovedAt?: Date | null;
    alumniPermanentlyPurgedAt?: Date | null;
  };
  if (
    !canAccessAlumniCommunity({
      accountType: u.accountType as "student" | "alumni" | null | undefined,
      grade: u.grade,
      role: u.role,
      alumniCommunityRemovedAt: u.alumniCommunityRemovedAt,
      alumniPermanentlyPurgedAt: u.alumniPermanentlyPurgedAt,
    })
  ) {
    return forbidden();
  }
  return null;
};
