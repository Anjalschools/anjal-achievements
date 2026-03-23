type RawRow = {
  studentName: string;
  grade: string;
  stageLabelAr: string;
  categoryLabelAr: string;
  eventLabelAr: string;
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
  level: string;
  participation: string;
  result: string;
  year: string;
  date: string;
  description: string;
  statusLabel: string;
  certificateStatusLabel: string;
};

export const reportStatusBadgeClass = (status: string): string => {
  if (status === "approved") return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  if (status === "pending" || status === "pending_review") return "bg-amber-100 text-amber-900 ring-amber-200";
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

export const normalizeAchievementReportRow = (row: RawRow): NormalizedReportRow => ({
  studentName: row.studentName || "—",
  grade: row.grade || "—",
  stage: row.stageLabelAr || "غير محدد",
  achievementType: row.categoryLabelAr || "غير محدد",
  achievementName: row.eventLabelAr || "غير محدد",
  level: row.levelLabelAr || "غير محدد",
  participation: row.participationLabelAr || "غير محدد",
  result: row.resultLabelAr || "غير محدد",
  year: row.year != null ? String(row.year) : "—",
  date: row.dateLabelAr || "—",
  description: row.description || "—",
  statusLabel:
    row.status === "approved"
      ? "معتمد"
      : row.status === "pending" || row.status === "pending_review"
        ? "تحت المراجعة"
        : row.status === "needs_revision"
          ? "يحتاج تعديل"
          : row.status === "rejected"
            ? "مرفوض"
            : "غير محدد",
  certificateStatusLabel: row.certificateIssued ? "صادرة" : "غير صادرة",
});

export const normalizeAchievementReportData = (rows: RawRow[]): NormalizedReportRow[] =>
  rows.map(normalizeAchievementReportRow);
