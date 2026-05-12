import type { Types } from "mongoose";
import User from "@/models/User";
import { invalidateSessionUserCache } from "@/lib/auth-session-cache";
import { shouldPromoteStudentToAlumni } from "./should-promote-student";
import { normalizeGraduationYearToNumber } from "@/lib/alumni/graduation-year-normalize";
import { touchAlumniCohortForUser } from "@/lib/alumni/batch-service";

export type PromoteSingleResult = "promoted" | "skipped" | "not_found";

const defaultSecondaryGraduationYear = (): number => {
  const y = Number(process.env.ALUMNI_PROMOTION_GRADUATION_YEAR || "");
  if (Number.isFinite(y) && y >= 1950 && y <= 2100) return y;
  return new Date().getFullYear();
};

/**
 * Idempotent single-user promotion. Guard in filter prevents double promotion.
 */
export const promoteOneStudentToAlumni = async (
  userId: string | Types.ObjectId,
  options?: { dryRun?: boolean }
): Promise<PromoteSingleResult> => {
  const id = String(userId);
  const doc = await User.findById(id).select("role status accountType grade alumniProfile email").lean();
  if (!doc) return "not_found";

  if (!shouldPromoteStudentToAlumni(doc as Parameters<typeof shouldPromoteStudentToAlumni>[0])) {
    return "skipped";
  }

  if (options?.dryRun) return "promoted";

  const gradYear =
    normalizeGraduationYearToNumber(
      (doc as { alumniProfile?: { graduationYear?: unknown } }).alumniProfile?.graduationYear
    ) ?? defaultSecondaryGraduationYear();

  const res = await User.updateOne(
    {
      _id: id,
      role: "student",
      status: "active",
      accountType: { $ne: "alumni" },
      "alumniProfile.alumniActivationStatus": { $ne: "promoted_from_student" },
    },
    {
      $set: {
        accountType: "alumni",
        needsAlumniOnboarding: true,
        "alumniProfile.alumniActivationStatus": "promoted_from_student",
        "alumniProfile.graduationYear": gradYear,
      },
      $unset: { completedAlumniOnboardingAt: "" },
    }
  );

  if (res.modifiedCount < 1) return "skipped";

  const email = String((doc as { email?: string }).email || "");
  invalidateSessionUserCache(id, email);
  void touchAlumniCohortForUser(id);
  return "promoted";
};
