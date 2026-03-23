import { normalizeGrade } from "@/constants/grades";

export type ReportStage = "primary" | "middle" | "secondary" | "unknown";

export const getStageByGrade = (grade: string | undefined | null): ReportStage => {
  const g = normalizeGrade(String(grade || "")) || "";
  if (!g) return "unknown";
  const n = Number(g.replace("g", ""));
  if (!Number.isFinite(n)) return "unknown";
  if (n >= 1 && n <= 6) return "primary";
  if (n >= 7 && n <= 9) return "middle";
  if (n >= 10 && n <= 12) return "secondary";
  return "unknown";
};

export const reportStageLabel = (stage: ReportStage, isAr: boolean): string => {
  if (stage === "primary") return isAr ? "ابتدائي" : "Primary";
  if (stage === "middle") return isAr ? "متوسط" : "Middle";
  if (stage === "secondary") return isAr ? "ثانوي" : "Secondary";
  return isAr ? "غير محدد" : "Unknown";
};
