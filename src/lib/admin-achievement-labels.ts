import { extractAttachmentUrl } from "@/lib/achievement-attachments";
import { getGradeLabel } from "@/constants/grades";
import {
  normalizeInferredFieldCandidate,
  getInferredFieldUiLabel,
} from "@/lib/achievement-inferred-field-allowlist";
import { getDbAchievementTypeLabel, labelAchievementSlugOrKey } from "@/lib/achievement-labels";
import {
  formatLocalizedResultLine,
  getAchievementDisplayName,
  getDisplayLabel,
  labelAchievementCategory,
  labelAchievementClassification,
  getAchievementLevelLabel,
} from "@/lib/achievementDisplay";

export type AdminLabelLocale = "ar" | "en";

/** Safe placeholder for empty cells */
export const emptyCell = (_loc: AdminLabelLocale): string => "—";

export const emptyOrDash = (v: unknown, loc: AdminLabelLocale): string => {
  if (v === null || v === undefined) return emptyCell(loc);
  const s = String(v).trim();
  if (!s) return loc === "ar" ? "غير محدد" : "—";
  return s;
};

/** DB `achievementType` → localized label (covers olympiad, mawhiba_annual, slugs, events). */
export const formatAchievementTypeLabel = (v: string | undefined, loc: AdminLabelLocale) =>
  getDbAchievementTypeLabel(v ?? "", loc);

export const formatAchievementCategoryLabel = (v: string | undefined, loc: AdminLabelLocale) => {
  const raw = labelAchievementCategory(v, loc);
  if (raw && raw !== "—") return raw;
  return v ? getDisplayLabel(v, loc) : loc === "ar" ? "غير محدد" : "—";
};

/**
 * Inferred field / domain: allowlist first, then known slug maps (competitions, olympiad events, etc.).
 * Avoids raw keys like `physics`, `wro`, `nesmo_stage_1` in admin UI.
 */
export const formatAchievementFieldLabel = (v: string | undefined, loc: AdminLabelLocale): string => {
  const s = String(v ?? "").trim();
  if (!s) return loc === "ar" ? "غير محدد" : "—";
  const norm = normalizeInferredFieldCandidate(s);
  if (norm === "other") return loc === "ar" ? "غير محدد" : "Not specified";
  const fromList = getInferredFieldUiLabel(s, loc);
  if (fromList) return fromList;
  return labelAchievementSlugOrKey(s, loc);
};

export const formatAchievementLevelLabel = (v: string | undefined, loc: AdminLabelLocale) =>
  getAchievementLevelLabel(v, loc);

export const formatAchievementClassificationLabel = (v: string | undefined, loc: AdminLabelLocale) =>
  labelAchievementClassification(v, loc);

export const formatOrgLabel = (raw: Record<string, unknown>, loc: AdminLabelLocale): string => {
  const org = String(raw.organization || "").trim();
  if (org) return org;
  const c =
    String(raw.customCompetitionName || raw.customProgramName || raw.customExhibitionName || "").trim();
  if (c) return c;
  const comp = String(raw.competitionName || raw.programName || raw.exhibitionName || "").trim();
  if (comp) return getDisplayLabel(comp, loc);
  const legacy = String(raw.competition || "").trim();
  return legacy ? getDisplayLabel(legacy, loc) : loc === "ar" ? "غير محدد" : "—";
};

export const formatResultLine = (raw: Record<string, unknown>, loc: AdminLabelLocale): string => {
  const rt = String(raw.resultType || "");
  const medal = String(raw.medalType || "");
  const rank = String(raw.rank || "");
  const scoreVal =
    typeof raw.resultValue === "number"
      ? raw.resultValue
      : Number(raw.resultValue) || undefined;
  return formatLocalizedResultLine(rt, medal, rank, loc, scoreVal);
};

export const formatParticipationLabel = (v: string | undefined, loc: AdminLabelLocale): string => {
  const k = String(v || "").toLowerCase();
  if (k === "individual") return loc === "ar" ? "فردي" : "Individual";
  if (k === "team") return loc === "ar" ? "فريق" : "Team";
  return loc === "ar" ? "غير محدد" : "—";
};

export const formatStudentGenderLabel = (v: string | undefined, loc: AdminLabelLocale): string => {
  const k = String(v ?? "").trim().toLowerCase();
  if (k === "male") return loc === "ar" ? "ذكر" : "Male";
  if (k === "female") return loc === "ar" ? "أنثى" : "Female";
  if (!k) return loc === "ar" ? "غير محدد" : "—";
  return labelAchievementSlugOrKey(v, loc);
};

/** User `section` (track): arabic | international */
export const formatStudentSectionLabel = (v: string | undefined, loc: AdminLabelLocale): string => {
  const k = String(v ?? "").trim().toLowerCase();
  if (!k) return loc === "ar" ? "غير محدد" : "—";
  if (k === "arabic") return loc === "ar" ? "عربي" : "Arabic track";
  if (k === "international") return loc === "ar" ? "دولي" : "International";
  return labelAchievementSlugOrKey(v, loc);
};

export const formatDirectoryGradeLabel = (v: string | undefined, loc: AdminLabelLocale): string =>
  getGradeLabel(v, loc);

/**
 * Achievement `studentSourceType` (linked_user | external_student | …) + legacy synonyms.
 */
export const formatStudentSourceTypeLabel = (v: string | undefined, loc: AdminLabelLocale): string => {
  const k = String(v ?? "").trim().toLowerCase();
  if (!k) return loc === "ar" ? "طالب مسجل" : "Registered student";
  const map: Record<string, { ar: string; en: string }> = {
    linked_user: { ar: "طالب مسجل", en: "Registered student" },
    external_student: { ar: "طالب خارجي", en: "External student" },
    alumni_student: { ar: "خريج", en: "Alumni" },
    registered: { ar: "مسجّل", en: "Registered" },
    manual: { ar: "إدخال إداري", en: "Admin entry" },
    external: { ar: "خارجي", en: "External" },
    linked: { ar: "مرتبط بحساب", en: "Linked account" },
  };
  const row = map[k];
  if (row) return loc === "ar" ? row.ar : row.en;
  return labelAchievementSlugOrKey(v, loc);
};

/** Workflow `status` string on achievement rows (directory / lists). */
export const formatWorkflowStatusLabel = (v: string | undefined, loc: AdminLabelLocale): string => {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return loc === "ar" ? "غير محدد" : "—";
  const map: Record<string, { ar: string; en: string }> = {
    pending: { ar: "قيد الانتظار", en: "Pending" },
    pending_review: { ar: "بانتظار المراجعة", en: "Pending review" },
    pending_re_review: { ar: "بانتظار إعادة المراجعة", en: "Pending re-review" },
    needs_revision: { ar: "يحتاج تعديل", en: "Needs revision" },
    approved: { ar: "معتمد", en: "Approved" },
    rejected: { ar: "مرفوض", en: "Rejected" },
    featured: { ar: "مميز", en: "Featured" },
  };
  if (map[s]) return loc === "ar" ? map[s].ar : map[s].en;
  return labelAchievementSlugOrKey(v, loc);
};

/** Directory card title — same resolution as student detail (no raw slugs when avoidable). */
export const formatDirectoryAchievementTitle = (
  row: {
    title?: string;
    nameAr?: string;
    nameEn?: string;
    achievementName?: string;
    customAchievementName?: string;
    titleAr?: string;
  },
  loc: AdminLabelLocale
): string => getAchievementDisplayName(row as Record<string, unknown>, loc);

export const resolveAchievementTitleForAdmin = (raw: Record<string, unknown>, loc: AdminLabelLocale): string => {
  const title = getAchievementDisplayName(raw, loc);
  if (title && title !== "إنجاز" && title !== "Achievement") return title;
  const typeLabel = formatAchievementTypeLabel(String(raw.achievementType || ""), loc);
  return typeLabel || (loc === "ar" ? "إنجاز" : "Achievement");
};

export const attachmentSummary = (
  attachments: unknown[] | undefined,
  image: string | null | undefined,
  loc: AdminLabelLocale
): { count: number; hasPdf: boolean; label: string } => {
  const list = Array.isArray(attachments)
    ? attachments.map((x) => extractAttachmentUrl(x)).filter((x): x is string => Boolean(x))
    : [];
  const hasImg = Boolean(image && String(image).trim());
  const count = list.length + (hasImg ? 1 : 0);
  const hasPdf = list.some((u) => /\.pdf(\?|$)/i.test(u) || u.toLowerCase().includes("pdf"));
  if (count === 0) {
    return { count: 0, hasPdf: false, label: loc === "ar" ? "لا توجد مرفقات" : "No attachments" };
  }
  const pdfTag = hasPdf ? (loc === "ar" ? " · PDF" : " · PDF") : "";
  return {
    count,
    hasPdf,
    label:
      loc === "ar"
        ? `${count} مرفق/مرفقات${pdfTag}`
        : `${count} attachment(s)${pdfTag}`,
  };
};
