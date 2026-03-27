import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { ACHIEVEMENT_REVIEWER_ROLES_LIST } from "@/lib/achievement-reviewer-roles";
import { achievementVisibleToStaff } from "@/lib/achievement-scope-filter";
import { requirePermission } from "@/lib/requirePermission";
import { PERMISSIONS } from "@/constants/permissions";
import { warnSecurityEvent } from "@/lib/security-log";

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
    warnSecurityEvent("access_denied", { reason: "no_session", context: "achievement_reviewer" });
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const role = String(user.role || "");
  const allowedByPermission = await requirePermission(user as any, PERMISSIONS.achievementsReview);
  if (!REVIEWER_ROLES.has(role) && !allowedByPermission) {
    warnSecurityEvent("access_denied", { reason: "forbidden_reviewer", role });
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}

/** Achievement reviewer + organizational scope (same achievement id). */
export async function requireAchievementReviewerForAchievementId(
  achievementId: string
): Promise<ReviewerGate> {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate;
  if (!mongoose.Types.ObjectId.isValid(achievementId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid achievement id" }, { status: 400 }),
    };
  }
  const allowed = await achievementVisibleToStaff(achievementId, gate.user);
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return gate;
}
