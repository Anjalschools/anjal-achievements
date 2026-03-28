import {
  getAchievementFieldLabel,
  getAchievementLevelLabel,
  getAdminDashboardWorkflowBucketLabel,
  humanizeRawKeyForDisplay,
} from "@/lib/achievement-display-labels";

export const statusBucketLabel = (key: string, isAr: boolean): string =>
  getAdminDashboardWorkflowBucketLabel(key, isAr ? "ar" : "en");

export const statusBucketColor = (key: string): string => {
  const colors: Record<string, string> = {
    pending: "#f59e0b",
    needs_revision: "#ea580c",
    pending_re_review: "#2563eb",
    approved: "#10b981",
    featured: "#7c3aed",
    rejected: "#ef4444",
  };
  return colors[key] || "#94a3b8";
};

export const levelKeyLabel = (key: string, isAr: boolean): string => {
  const loc = isAr ? "ar" : "en";
  const lbl = getAchievementLevelLabel(key, loc);
  if (lbl && lbl !== "—" && lbl.trim() && lbl.toLowerCase() !== String(key).toLowerCase()) return lbl;
  return humanizeRawKeyForDisplay(key, loc);
};

export const domainKeyLabel = (key: string, isAr: boolean): string => {
  const loc = isAr ? "ar" : "en";
  const lbl = getAchievementFieldLabel(key, loc);
  if (lbl && lbl !== "—" && lbl.trim() && lbl.toLowerCase() !== String(key).toLowerCase()) return lbl;
  return humanizeRawKeyForDisplay(key, loc);
};

export const roleLabel = (role: string, isAr: boolean): string => {
  const map: Record<string, [string, string]> = {
    student: ["الطلاب", "Students"],
    judge: ["المحكمون", "Judges"],
    teacher: ["رواد النشاط", "Activity leaders"],
    schoolAdmin: ["مديرو المدارس", "School admins"],
    admin: ["الأدمن", "Admins"],
    supervisor: ["المشرفون", "Supervisors"],
  };
  const pair = map[role];
  if (pair) return isAr ? pair[0] : pair[1];
  return humanizeRawKeyForDisplay(role, isAr ? "ar" : "en");
};

export const roleAccentClass = (role: string): string => {
  const c: Record<string, string> = {
    student: "border-sky-200 bg-sky-50 text-sky-950",
    judge: "border-violet-200 bg-violet-50 text-violet-950",
    teacher: "border-amber-200 bg-amber-50 text-amber-950",
    schoolAdmin: "border-emerald-200 bg-emerald-50 text-emerald-950",
    admin: "border-rose-200 bg-rose-50 text-rose-950",
    supervisor: "border-indigo-200 bg-indigo-50 text-indigo-950",
  };
  return c[role] || "border-gray-200 bg-gray-50 text-gray-900";
};
