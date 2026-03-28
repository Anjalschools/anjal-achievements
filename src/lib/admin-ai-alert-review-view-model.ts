/**
 * View-model for admin "AI alert" review tab — human labels + sort keys (no raw enums in UI).
 */

import { DUPLICATE_FLAG, LEVEL_MISMATCH_FLAG } from "@/lib/achievement-review-rules";
import {
  formatAchievementLevelLabel,
  resolveAchievementTitleForAdmin,
} from "@/lib/admin-achievement-labels";

export type UiTone = "success" | "danger" | "warning" | "neutral" | "muted";

/** Client-side sort keys for the admin AI alert table (review page + optional reuse). */
export type AdminAiAlertTableSortKey = "severity" | "student" | "title" | "level" | "overall" | "review";

export type AdminAiAlertListRowInput = {
  id: string;
  title: string;
  achievementType?: string;
  achievementCategory?: string;
  achievementClassification?: string;
  achievementLevel?: string;
  competitionName?: string;
  programName?: string;
  exhibitionName?: string;
  customCompetitionName?: string;
  customAchievementName?: string;
  achievementName?: string;
  nameAr?: string;
  nameEn?: string;
  student: { fullName: string };
  adminAttachmentOverall: string | null;
  adminAttachmentAiReview: Record<string, unknown> | null | undefined;
  adminDuplicateMarked: boolean;
  aiFlags: string[];
  aiReviewStatus?: string;
  duplicateYearHint: { hasYearDuplicate: boolean; yearDuplicateCount: number } | null;
};

/** Map admin list API row → alert view-model input (client or server). */
export const achievementApiRowToAiAlertInput = (row: Record<string, unknown>): AdminAiAlertListRowInput => ({
  id: String(row.id ?? ""),
  title: String(row.title || ""),
  achievementType: row.achievementType as string | undefined,
  achievementCategory: row.achievementCategory as string | undefined,
  achievementClassification: row.achievementClassification as string | undefined,
  achievementLevel: row.achievementLevel as string | undefined,
  competitionName: row.competitionName as string | undefined,
  programName: row.programName as string | undefined,
  exhibitionName: row.exhibitionName as string | undefined,
  customCompetitionName: row.customCompetitionName as string | undefined,
  customAchievementName: row.customAchievementName as string | undefined,
  achievementName: row.achievementName as string | undefined,
  nameAr: row.nameAr as string | undefined,
  nameEn: row.nameEn as string | undefined,
  student: (row.student as { fullName: string }) || { fullName: "" },
  adminAttachmentOverall: (row.adminAttachmentOverall as string | null) ?? null,
  adminAttachmentAiReview: (row.adminAttachmentAiReview as Record<string, unknown> | null) ?? null,
  adminDuplicateMarked: row.adminDuplicateMarked === true,
  aiFlags: Array.isArray(row.aiFlags) ? (row.aiFlags as string[]) : [],
  aiReviewStatus: row.aiReviewStatus as string | undefined,
  duplicateYearHint:
    (row.duplicateYearHint as AdminAiAlertListRowInput["duplicateYearHint"] | undefined) ?? null,
});

export type AdminAiAlertRowViewModel = {
  id: string;
  studentName: string;
  achievementTitle: string;
  levelLabel: string;
  /** Normalized string for client-side sorting by level label */
  sortLevelKey: string;
  duplicateStatusLabel: string;
  duplicateStatusTone: UiTone;
  nameCheckLabel: string;
  nameCheckTone: UiTone;
  yearCheckLabel: string;
  yearCheckTone: UiTone;
  levelCheckLabel: string;
  levelCheckTone: UiTone;
  achievementCheckLabel: string;
  achievementCheckTone: UiTone;
  overallStatusLabel: string;
  overallStatusTone: UiTone;
  hasDetails: boolean;
  sortPriority: number;
  sortStudent: string;
  sortTitle: string;
};

const norm = (v: unknown): string => String(v || "").trim().toLowerCase();

const checkRaw = (checks: Record<string, unknown> | undefined, key: string): string | null => {
  if (!checks) return null;
  const v = checks[key];
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "match" || s === "mismatch" || s === "unclear") return s;
  return null;
};

export const mapAttachmentCheckToUi = (
  raw: string | null,
  loc: "ar" | "en"
): { label: string; tone: UiTone } => {
  if (raw === "match") {
    return { label: loc === "ar" ? "مطابق" : "Match", tone: "success" };
  }
  if (raw === "mismatch") {
    return { label: loc === "ar" ? "غير مطابق" : "Mismatch", tone: "danger" };
  }
  if (raw === "unclear") {
    return { label: loc === "ar" ? "غير واضح" : "Unclear", tone: "warning" };
  }
  return {
    label: loc === "ar" ? "لم يُحلل بعد" : "Not analyzed",
    tone: "muted",
  };
};

export const mapOverallToUi = (
  raw: string | null | undefined,
  loc: "ar" | "en"
): { label: string; tone: UiTone } => {
  const s = norm(raw);
  if (s === "match") {
    return { label: loc === "ar" ? "مطابق" : "Match", tone: "success" };
  }
  if (s === "mismatch") {
    return { label: loc === "ar" ? "غير مطابق" : "Mismatch", tone: "danger" };
  }
  if (s === "unclear") {
    return { label: loc === "ar" ? "غير واضح" : "Unclear", tone: "warning" };
  }
  return {
    label: loc === "ar" ? "لم يُحلل بعد" : "Not analyzed",
    tone: "muted",
  };
};

export const mapDuplicateColumnToUi = (
  input: {
    adminDuplicateMarked: boolean;
    hasYearDuplicate: boolean;
    yearDuplicateCount: number;
    aiDuplicateFlag: boolean;
    duplicateHintLoaded: boolean;
  },
  loc: "ar" | "en"
): { label: string; tone: UiTone } => {
  if (input.adminDuplicateMarked) {
    return {
      label: loc === "ar" ? "يوجد تكرار (قرار إداري)" : "Duplicate (admin marked)",
      tone: "danger",
    };
  }
  if (input.hasYearDuplicate) {
    const n = input.yearDuplicateCount;
    return {
      label:
        loc === "ar"
          ? `يوجد تكرار (${n} سجل)`
          : `Duplicate (${n} record(s))`,
      tone: "danger",
    };
  }
  if (input.aiDuplicateFlag) {
    return {
      label: loc === "ar" ? "اشتباه تكرار (AI)" : "Duplicate suspicion (AI)",
      tone: "warning",
    };
  }
  if (!input.duplicateHintLoaded) {
    return {
      label: loc === "ar" ? "لم يُفحص بعد" : "Not checked",
      tone: "muted",
    };
  }
  return {
    label: loc === "ar" ? "لا يوجد تكرار" : "No duplicate",
    tone: "success",
  };
};

const anyCheckMismatch = (checks: Record<string, unknown> | undefined): boolean => {
  if (!checks) return false;
  for (const k of ["nameCheck", "yearCheck", "levelCheck", "achievementCheck", "resultCheck"] as const) {
    if (checkRaw(checks, k) === "mismatch") return true;
  }
  return false;
};

const anyCheckUnclear = (checks: Record<string, unknown> | undefined): boolean => {
  if (!checks) return false;
  for (const k of ["nameCheck", "yearCheck", "levelCheck", "achievementCheck", "resultCheck"] as const) {
    if (checkRaw(checks, k) === "unclear") return true;
  }
  return false;
};

/** Lower = higher priority in review queue. */
export const computeAiAlertSortPriority = (input: AdminAiAlertListRowInput): number => {
  const overall = norm(input.adminAttachmentOverall);
  const ar = input.adminAttachmentAiReview;
  const checks =
    ar && typeof ar === "object" ? (ar.checks as Record<string, unknown> | undefined) : undefined;
  const hasAnalysis = Boolean(ar && typeof ar === "object");

  if (overall === "mismatch" || anyCheckMismatch(checks)) return 0;
  if (overall === "unclear" || (hasAnalysis && anyCheckUnclear(checks))) return 1;

  const aiDup = input.aiFlags.includes(DUPLICATE_FLAG);
  const dupAttention =
    input.adminDuplicateMarked ||
    (input.duplicateYearHint?.hasYearDuplicate ?? false) ||
    aiDup;

  if (dupAttention) return 2;

  if (input.aiFlags.includes(LEVEL_MISMATCH_FLAG)) return 2;

  if (norm(input.aiReviewStatus) === "flagged") return 3;

  return 4;
};

export const buildAiAlertRowViewModel = (
  row: AdminAiAlertListRowInput,
  loc: "ar" | "en"
): AdminAiAlertRowViewModel => {
  const rawRec = row as unknown as Record<string, unknown>;
  const achievementTitle = resolveAchievementTitleForAdmin(rawRec, loc);
  const levelLabel = formatAchievementLevelLabel(String(row.achievementLevel || ""), loc);

  const ar = row.adminAttachmentAiReview;
  const checks =
    ar && typeof ar === "object" ? (ar.checks as Record<string, unknown> | undefined) : undefined;

  const overallRaw =
    (typeof row.adminAttachmentOverall === "string" && row.adminAttachmentOverall) ||
    (ar && typeof ar === "object" && typeof (ar as { overallMatchStatus?: string }).overallMatchStatus === "string"
      ? String((ar as { overallMatchStatus?: string }).overallMatchStatus)
      : null);

  const dupHintLoaded = row.duplicateYearHint !== null;
  const yearDup = row.duplicateYearHint?.hasYearDuplicate ?? false;
  const yearCount = row.duplicateYearHint?.yearDuplicateCount ?? 0;
  const aiDupFlag = row.aiFlags.includes(DUPLICATE_FLAG);

  const dupUi = mapDuplicateColumnToUi(
    {
      adminDuplicateMarked: row.adminDuplicateMarked,
      hasYearDuplicate: yearDup,
      yearDuplicateCount: yearCount,
      aiDuplicateFlag: aiDupFlag,
      duplicateHintLoaded: dupHintLoaded,
    },
    loc
  );

  const nameUi = mapAttachmentCheckToUi(checkRaw(checks, "nameCheck"), loc);
  const yearUi = mapAttachmentCheckToUi(checkRaw(checks, "yearCheck"), loc);
  const levelUi = mapAttachmentCheckToUi(checkRaw(checks, "levelCheck"), loc);
  const achUi = mapAttachmentCheckToUi(checkRaw(checks, "achievementCheck"), loc);
  const overallUi = mapOverallToUi(overallRaw, loc);

  const hasDetails = Boolean(ar && typeof ar === "object");

  const studentName = String(row.student?.fullName || "").trim() || (loc === "ar" ? "—" : "—");
  const levelResolved = levelLabel.trim() || (loc === "ar" ? "غير محدد" : "—");

  return {
    id: row.id,
    studentName,
    achievementTitle,
    levelLabel: levelResolved,
    sortLevelKey: levelResolved.toLocaleLowerCase(loc === "ar" ? "ar" : "en"),
    duplicateStatusLabel: dupUi.label,
    duplicateStatusTone: dupUi.tone,
    nameCheckLabel: nameUi.label,
    nameCheckTone: nameUi.tone,
    yearCheckLabel: yearUi.label,
    yearCheckTone: yearUi.tone,
    levelCheckLabel: levelUi.label,
    levelCheckTone: levelUi.tone,
    achievementCheckLabel: achUi.label,
    achievementCheckTone: achUi.tone,
    overallStatusLabel: overallUi.label,
    overallStatusTone: overallUi.tone,
    hasDetails,
    sortPriority: computeAiAlertSortPriority(row),
    sortStudent: studentName.toLocaleLowerCase(loc === "ar" ? "ar" : "en"),
    sortTitle: achievementTitle.toLocaleLowerCase(loc === "ar" ? "ar" : "en"),
  };
};

export const sortAiAlertViewModels = (a: AdminAiAlertRowViewModel, b: AdminAiAlertRowViewModel): number => {
  if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
  const c1 = a.sortStudent.localeCompare(b.sortStudent, undefined, { sensitivity: "base" });
  if (c1 !== 0) return c1;
  return a.sortTitle.localeCompare(b.sortTitle, undefined, { sensitivity: "base" });
};

/** Client-side sort for AI alert table (current page). */
export const compareAiAlertRowsClient = (
  a: AdminAiAlertRowViewModel,
  b: AdminAiAlertRowViewModel,
  key: AdminAiAlertTableSortKey,
  asc: boolean
): number => {
  const tie = sortAiAlertViewModels(a, b);
  if (key === "review") {
    return tie;
  }
  if (key === "severity" || key === "overall") {
    return tie;
  }
  if (key === "student") {
    const c = a.sortStudent.localeCompare(b.sortStudent, undefined, { sensitivity: "base" });
    if (c !== 0) return asc ? c : -c;
    return tie;
  }
  if (key === "title") {
    const c = a.sortTitle.localeCompare(b.sortTitle, undefined, { sensitivity: "base" });
    if (c !== 0) return asc ? c : -c;
    return tie;
  }
  const c = a.sortLevelKey.localeCompare(b.sortLevelKey, undefined, { sensitivity: "base" });
  if (c !== 0) return asc ? c : -c;
  return tie;
};

/** Server-side list sort (locale-neutral student/title compare). */
export const compareAiAlertListRows = (a: AdminAiAlertListRowInput, b: AdminAiAlertListRowInput): number => {
  const pa = computeAiAlertSortPriority(a);
  const pb = computeAiAlertSortPriority(b);
  if (pa !== pb) return pa - pb;
  const sa = String(a.student?.fullName || "").toLowerCase();
  const sb = String(b.student?.fullName || "").toLowerCase();
  const c1 = sa.localeCompare(sb, undefined, { sensitivity: "base" });
  if (c1 !== 0) return c1;
  const ta = String(a.title || "").toLowerCase();
  const tb = String(b.title || "").toLowerCase();
  return ta.localeCompare(tb, undefined, { sensitivity: "base" });
};

export const toneToBadgeClass = (tone: UiTone): string => {
  switch (tone) {
    case "success":
      return "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/80";
    case "danger":
      return "bg-red-100 text-red-950 ring-1 ring-red-200/80";
    case "warning":
      return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80";
    case "muted":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80";
    default:
      return "bg-gray-100 text-gray-800 ring-1 ring-gray-200/80";
  }
};
