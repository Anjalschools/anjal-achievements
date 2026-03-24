import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { ACHIEVEMENT_REVIEWER_ROLES_LIST } from "@/lib/achievement-reviewer-roles";

/** Admin, supervisor, school lead, activity lead (teacher), evaluator (judge) */
export const REVIEWER_ROLES_LIST = ACHIEVEMENT_REVIEWER_ROLES_LIST;

const REVIEWER_ROLES = new Set<string>(REVIEWER_ROLES_LIST);

export type ReviewerUser = NonNullable<Awaited<ReturnType<typeof getCurrentDbUser>>>;

export type ReviewerGate =
  | { ok: true; user: ReviewerUser }
  | { ok: false; response: NextResponse };

export async function requireAchievementReviewer(): Promise<ReviewerGate> {
  const user = await getCurrentDbUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const role = String(user.role || "");
  if (!REVIEWER_ROLES.has(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
