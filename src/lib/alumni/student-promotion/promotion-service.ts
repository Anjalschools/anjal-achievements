import "server-only";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { THIRD_SECONDARY_GRADE_RAW_HINTS } from "./normalize-grade";
import { shouldPromoteStudentToAlumni } from "./should-promote-student";
import { promoteOneStudentToAlumni } from "./promote-student-to-alumni";
import type { RunStudentPromotionResult } from "./promotion-types";

/**
 * Bulk promotion: loads candidates with a tight DB pre-filter, then promotes with per-document guards (idempotent).
 */
export const runStudentPromotionJob = async (input?: {
  dryRun?: boolean;
}): Promise<RunStudentPromotionResult> => {
  const dryRun = input?.dryRun === true;
  await connectDB();

  const gradeHints = [...THIRD_SECONDARY_GRADE_RAW_HINTS];

  const candidates = await User.find({
    role: "student",
    status: "active",
    $or: [{ accountType: { $exists: false } }, { accountType: "student" }],
    $and: [
      {
        $or: [{ grade: { $in: gradeHints } }, { grade: { $regex: /^(g12|12|grade12)$/i } }],
      },
      {
        $or: [
          { "alumniProfile.alumniActivationStatus": { $exists: false } },
          { "alumniProfile.alumniActivationStatus": { $ne: "promoted_from_student" } },
        ],
      },
    ],
  })
    .select("_id role status accountType grade alumniProfile")
    .lean();

  let examined = 0;
  let promoted = 0;
  let skipped = 0;

  for (const row of candidates) {
    examined += 1;
    if (!shouldPromoteStudentToAlumni(row)) {
      skipped += 1;
      continue;
    }
    const r = await promoteOneStudentToAlumni(String(row._id), { dryRun });
    if (r === "promoted") promoted += 1;
    else skipped += 1;
  }

  return { ok: true, dryRun, examined, promoted, skipped };
};
