import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { GRADE_OPTIONS, normalizeGrade, getGradeLabel } from "@/constants/grades";

export type PromotionPreviewRow = {
  studentId: string;
  fullName: string;
  currentGrade: string;
  currentGradeLabelAr: string;
  currentGradeLabelEn: string;
  nextGrade: string | null;
  nextGradeLabelAr: string | null;
  nextGradeLabelEn: string | null;
  currentStage: string;
  nextStage: string | null;
};

const gradeToStage = (grade: string): string => {
  const normalized = normalizeGrade(grade) || "";
  const num = parseInt(normalized.replace("g", ""), 10);
  if (num >= 1 && num <= 6) return "elementary";
  if (num >= 7 && num <= 9) return "middle";
  if (num >= 10 && num <= 12) return "high";
  return "unknown";
};

const nextGradeValue = (grade: string): string | null => {
  const normalized = normalizeGrade(grade);
  if (!normalized) return null;
  const idx = GRADE_OPTIONS.findIndex((row) => row.value === normalized);
  if (idx < 0 || idx >= GRADE_OPTIONS.length - 1) return null;
  return GRADE_OPTIONS[idx + 1].value;
};

export const getEligibleStudents = async (): Promise<PromotionPreviewRow[]> => {
  await connectDB();
  const students = await User.find({ role: "student", status: "active" })
    .select("fullName fullNameAr grade")
    .sort({ grade: 1, fullName: 1 })
    .lean();

  return students.map((student) => {
    const currentGrade = normalizeGrade(student.grade) || String(student.grade || "");
    const nextGrade = nextGradeValue(currentGrade);
    return {
      studentId: String(student._id),
      fullName: String(student.fullNameAr || student.fullName || ""),
      currentGrade,
      currentGradeLabelAr: getGradeLabel(currentGrade, "ar"),
      currentGradeLabelEn: getGradeLabel(currentGrade, "en"),
      nextGrade,
      nextGradeLabelAr: nextGrade ? getGradeLabel(nextGrade, "ar") : null,
      nextGradeLabelEn: nextGrade ? getGradeLabel(nextGrade, "en") : null,
      currentStage: gradeToStage(currentGrade),
      nextStage: nextGrade ? gradeToStage(nextGrade) : null,
    };
  });
};

export const buildPromotionPlan = async () => {
  const students = await getEligibleStudents();
  return {
    totalStudents: students.length,
    promotableStudents: students.filter((row) => row.nextGrade).length,
    graduatingStudents: students.filter((row) => !row.nextGrade).length,
    rows: students,
  };
};

export const getPromotionPreview = async () => {
  const plan = await buildPromotionPlan();
  return {
    previewOnly: true,
    messageAr: "معاينة فقط — لا يتم حفظ أي تغييرات.",
    messageEn: "Preview only — no changes are persisted.",
    ...plan,
  };
};
