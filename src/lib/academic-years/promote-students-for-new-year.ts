import mongoose from "mongoose";
import User from "@/models/User";
import { normalizeGrade } from "@/constants/grades";
import { nextGradeValue } from "./promotion-preview";

export type StudentPromotionSummary = {
  totalEligible: number;
  promotedCount: number;
  graduatedCount: number;
};

/**
 * Advances active students to their next grade, and marks Grade 12 (g12) students as
 * `studentLifecycleStatus: "graduated"` (the existing institutional-record-protection marker —
 * see isInstitutionalRecordProtectedStudent / achievements/[id]/route.ts delete-lock check).
 * Reuses the same eligibility filter and grade-order mapping as the existing promotion preview
 * (getEligibleStudents / nextGradeValue in ./promotion-preview) so this is not a new mapping.
 *
 * Must run inside the caller's mongoose transaction session: reads and writes share that
 * session's snapshot, so a concurrent duplicate "create academic year" call would hit a write
 * conflict on the same User documents instead of silently double-promoting them.
 */
export const promoteStudentsForNewAcademicYear = async (
  session: mongoose.ClientSession
): Promise<StudentPromotionSummary> => {
  const students = await User.find({ role: "student", status: "active" })
    .select("_id grade studentLifecycleStatus")
    .session(session)
    .lean();

  const ops: mongoose.AnyBulkWriteOperation[] = [];
  let promotedCount = 0;
  let graduatedCount = 0;

  for (const student of students) {
    const currentGrade = normalizeGrade(student.grade as string | null | undefined);
    if (!currentGrade) continue;

    const next = nextGradeValue(currentGrade);
    if (next) {
      ops.push({
        updateOne: {
          filter: { _id: student._id },
          update: { $set: { grade: next } },
        },
      });
      promotedCount += 1;
    } else if (student.studentLifecycleStatus !== "graduated") {
      ops.push({
        updateOne: {
          filter: { _id: student._id },
          update: { $set: { studentLifecycleStatus: "graduated" } },
        },
      });
      graduatedCount += 1;
    }
  }

  if (ops.length) {
    await User.bulkWrite(ops, { session });
  }

  return { totalEligible: students.length, promotedCount, graduatedCount };
};
