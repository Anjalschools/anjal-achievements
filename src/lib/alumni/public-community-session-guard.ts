import "server-only";
import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { canAccessAlumniCommunity } from "@/lib/alumni/canAccessAlumniCommunity";

/**
 * For public browse APIs: anonymous requests pass through; logged-in ineligible students get 403.
 */
export const blockIneligibleStudentOnPublicCommunityApi = async (): Promise<NextResponse | null> => {
  const user = await getCurrentDbUser();
  if (!user?._id) return null;
  const u = user as { role?: string; accountType?: string; grade?: string };
  if (
    !canAccessAlumniCommunity({
      accountType: u.accountType as "student" | "alumni" | null | undefined,
      grade: u.grade,
      role: u.role,
    })
  ) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  return null;
};
