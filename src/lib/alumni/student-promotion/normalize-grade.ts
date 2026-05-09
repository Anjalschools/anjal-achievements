import { normalizeGrade } from "@/constants/grades";

export { normalizeGrade };

/** Raw grade values that may appear in DB for third secondary (defensive). */
export const THIRD_SECONDARY_GRADE_RAW_HINTS = [
  "g12",
  "G12",
  "12",
  "grade12",
  "Grade12",
  "GRADE12",
] as const;
