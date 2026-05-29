import { normalizeGrade } from "@/constants/grades";
import { getStageByGrade, type ReportStage } from "@/lib/report-stage-mapping";
import type { CompetitionStageRowKey } from "@/lib/competitions/table-presets";

export type StudentStageInput = {
  grade?: string | null;
  section?: string | null;
  stage?: string | null;
  track?: string | null;
};

const normalizeSection = (raw: string | null | undefined): "arabic" | "international" | "unknown" => {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!s) return "unknown";
  if (s.includes("intl") || s.includes("international") || s.includes("دولي")) return "international";
  if (s.includes("arab") || s.includes("عربي")) return "arabic";
  if (s === "international") return "international";
  return "arabic";
};

export const resolveReportStage = (student: StudentStageInput): ReportStage => {
  const fromGrade = getStageByGrade(student.grade);
  if (fromGrade !== "unknown") return fromGrade;
  const st = String(student.stage ?? "").toLowerCase();
  if (st.includes("primary") || st.includes("ابتد")) return "primary";
  if (st.includes("middle") || st.includes("متوسط")) return "middle";
  if (st.includes("secondary") || st.includes("ثانوي")) return "secondary";
  return "unknown";
};

/** Maps student metadata → Excel row key (grade × section). */
export const resolveStudentStageRowKey = (student: StudentStageInput): CompetitionStageRowKey | null => {
  const stage = resolveReportStage(student);
  const section = normalizeSection(student.section);
  if (stage === "unknown" || section === "unknown") return null;
  if (stage === "primary" && section === "arabic") return "primary_ar";
  if (stage === "primary" && section === "international") return "primary_intl";
  if (stage === "middle" && section === "arabic") return "middle_ar";
  if (stage === "middle" && section === "international") return "middle_intl";
  if (stage === "secondary" && section === "arabic") return "secondary_ar";
  if (stage === "secondary" && section === "international") return "secondary_intl";
  return null;
};

export const resolveStudentStageLabel = (student: StudentStageInput, isAr: boolean): string => {
  const key = resolveStudentStageRowKey(student);
  if (!key) return isAr ? "غير محدد" : "Unspecified";
  const labels: Record<CompetitionStageRowKey, { ar: string; en: string }> = {
    primary_ar: { ar: "ابتدائي عربي", en: "Primary Arabic" },
    primary_intl: { ar: "ابتدائي دولي", en: "Primary International" },
    middle_ar: { ar: "متوسط عربي", en: "Middle Arabic" },
    middle_intl: { ar: "متوسط دولي", en: "Middle International" },
    secondary_ar: { ar: "ثانوي عربي", en: "Secondary Arabic" },
    secondary_intl: { ar: "ثانوي دولي", en: "Secondary International" },
    total: { ar: "المجموع", en: "Total" },
  };
  return isAr ? labels[key].ar : labels[key].en;
};

export const gradeMatchesFilter = (
  grade: string | null | undefined,
  allowedGrades: string[] | undefined
): boolean => {
  if (!allowedGrades?.length) return true;
  const g = normalizeGrade(grade) ?? "";
  return allowedGrades.some((a) => normalizeGrade(a) === g || String(a).trim() === g);
};
