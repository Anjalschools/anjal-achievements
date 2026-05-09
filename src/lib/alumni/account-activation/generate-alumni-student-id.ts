import { randomInt } from "crypto";
import User from "@/models/User";

/**
 * Reserved-style 10-digit studentId for alumni-only portal rows (unique; avoids clashing with real student IDs).
 */
export const generateUniqueAlumniStudentId = async (): Promise<string> => {
  for (let i = 0; i < 40; i += 1) {
    const n = randomInt(0, 100_000_000);
    const candidate = `99${String(n).padStart(8, "0")}`;
    const clash = await User.findOne({ studentId: candidate }).select("_id").lean();
    if (!clash) return candidate;
  }
  throw new Error("ALUMNI_STUDENT_ID_ALLOCATION_FAILED");
};
