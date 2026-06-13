import { normalizeGrade } from "@/constants/grades";
import type { IUser } from "@/models/User";
import { gradeToStage } from "@/lib/partnerships/partnerships-eligibility";

export type TrainingStudentSnapshot = {
  fullName: string;
  grade: string;
  stage: string;
  gender: string;
  schoolType?: string;
  school?: string;
};

const sectionLabel = (section: string | undefined): string | undefined => {
  const value = String(section || "").trim();
  if (!value) return undefined;
  if (value === "arabic") return "arabic";
  if (value === "international") return "international";
  return value;
};

const schoolDisplayName = (section: string | undefined, locale: "ar" | "en" = "ar"): string | undefined => {
  const value = sectionLabel(section);
  if (!value) return undefined;
  if (value === "arabic") return locale === "ar" ? "مسار عربي" : "Arabic track";
  if (value === "international") return locale === "ar" ? "مسار دولي" : "International track";
  return value;
};

export const buildTrainingStudentSnapshot = (user: IUser): TrainingStudentSnapshot => {
  const grade = normalizeGrade(user.grade) || String(user.grade || "").trim();
  const stage = gradeToStage(grade);
  const fullName = String(user.fullNameAr || user.fullName || user.username || "").trim();

  return {
    fullName,
    grade,
    stage,
    gender: String(user.gender || "").trim(),
    schoolType: sectionLabel(user.section),
    school: schoolDisplayName(user.section, "ar"),
  };
};
