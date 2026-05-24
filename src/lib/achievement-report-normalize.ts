import { getWorkflowStatusLabel } from "@/lib/achievement-display-labels";

const TEST_TYPE_LABELS: Record<string, string> = {
  qudrat: "القدرات",
  tahsili: "التحصيلي",
  sat: "SAT",
  ielts: "IELTS",
  toefl: "TOEFL",
  step: "STEP",
  act: "ACT",
  mawhiba: "موهبة",
  mawhiba_annual: "موهبة السنوي",
  gifted_discovery: "الكشف عن الموهوبين",
};

type RawRow = {
  studentName: string;
  grade: string;
  stageLabelAr: string;
  categoryLabelAr: string;
  eventLabelAr: string;
  analyticsActivityDisplayAr?: string;
  activityYear?: number | null;
  standardizedTestType?: string | null;
  levelLabelAr: string;
  participationLabelAr: string;
  resultLabelAr: string;
  year: number | null;
  dateLabelAr: string;
  description: string;
  status: string;
  certificateIssued: boolean;
};

export type NormalizedReportRow = {
  studentName: string;
  grade: string;
  stage: string;
  achievementType: string;
  achievementName: string;
  activityYear: string;
  testTypeLabel: string;
  result: string;
  level: string;
  participation: string;
  year: string;
  date: string;
  description: string;
  statusKey: string;
  statusLabel: string;
  certificateStatusLabel: string;
};

export const reportStatusBadgeClass = (status: string): string => {
  if (status === "approved") return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  if (status === "pending" || status === "pending_review") return "bg-amber-100 text-amber-900 ring-amber-200";
  if (status === "pending_re_review") return "bg-amber-100 text-amber-950 ring-amber-200";
  if (status === "needs_revision") return "bg-orange-100 text-orange-900 ring-orange-200";
  if (status === "rejected") return "bg-red-100 text-red-900 ring-red-200";
  return "bg-slate-100 text-slate-800 ring-slate-200";
};

export const reportLevelBadgeClass = (levelLabelAr: string): string => {
  const s = String(levelLabelAr || "").trim();
  if (s.includes("العالم") || s.includes("الدولي")) return "bg-violet-100 text-violet-900 ring-violet-200";
  if (s.includes("المملكة")) return "bg-blue-100 text-blue-900 ring-blue-200";
  if (s.includes("المحافظة") || s.includes("الإدارة") || s.includes("المنطقة"))
    return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  if (s.includes("المدرسة")) return "bg-slate-100 text-slate-900 ring-slate-200";
  return "bg-amber-100 text-amber-900 ring-amber-200";
};

export const normalizeAchievementReportRow = (row: RawRow): NormalizedReportRow => {
  const testKey = String(row.standardizedTestType || "").trim();
  return {
    studentName: row.studentName || "—",
    grade: row.grade || "—",
    stage: row.stageLabelAr || "غير محدد",
    achievementType: row.categoryLabelAr || "غير محدد",
    achievementName: row.analyticsActivityDisplayAr || row.eventLabelAr || "غير محدد",
    activityYear:
      row.activityYear != null
        ? String(row.activityYear)
        : row.year != null
          ? String(row.year)
          : "—",
    testTypeLabel: testKey ? TEST_TYPE_LABELS[testKey] || testKey : "—",
    result: row.resultLabelAr || "غير محدد",
    level: row.levelLabelAr || "غير محدد",
    participation: row.participationLabelAr || "غير محدد",
    year: row.year != null ? String(row.year) : "—",
    date: row.dateLabelAr || "—",
    description: row.description || "—",
    statusKey: String(row.status || ""),
    statusLabel: (() => {
      const w = getWorkflowStatusLabel(row.status, "ar");
      return w && w !== "—" ? w : "غير محدد";
    })(),
    certificateStatusLabel: row.certificateIssued ? "صادرة" : "غير صادرة",
  };
};

export const normalizeAchievementReportData = (rows: RawRow[]): NormalizedReportRow[] =>
  rows.map(normalizeAchievementReportRow);
