/**
 * Single entry point for user-visible labels (reports, dashboards, exports, cards).
 * Delegates to admin-achievement-labels / achievement-labels — do not duplicate maps here.
 */

import {
  formatAchievementTypeLabel,
  formatAchievementLevelLabel,
  formatAchievementFieldLabel,
  formatWorkflowStatusLabel,
  formatParticipationLabel,
  formatStudentGenderLabel,
  formatDirectoryGradeLabel,
  formatStudentSectionLabel,
  formatResultLine,
} from "@/lib/admin-achievement-labels";
import {
  getDisplayLabel,
  labelEvidenceMode,
  labelResultType,
  labelVerificationStatus,
} from "@/lib/achievementDisplay";
import { labelAchievementSlugOrKey } from "@/lib/achievement-labels";
import { reportStageLabel, type ReportStage } from "@/lib/report-stage-mapping";

export type DisplayLabelLocale = "ar" | "en";

const asStr = (v: unknown) => String(v ?? "").trim();

export const getAchievementTypeLabel = (value: unknown, locale: DisplayLabelLocale) =>
  formatAchievementTypeLabel(asStr(value) || undefined, locale);

export const getAchievementLevelLabel = (value: unknown, locale: DisplayLabelLocale) =>
  formatAchievementLevelLabel(asStr(value) || undefined, locale);

export const getAchievementFieldLabel = (value: unknown, locale: DisplayLabelLocale) =>
  formatAchievementFieldLabel(asStr(value) || undefined, locale);

export const getWorkflowStatusLabel = (value: unknown, locale: DisplayLabelLocale) =>
  formatWorkflowStatusLabel(asStr(value) || undefined, locale);

export const getParticipationTypeLabel = (value: unknown, locale: DisplayLabelLocale) =>
  formatParticipationLabel(asStr(value) || undefined, locale);

export const getGenderLabel = (value: unknown, locale: DisplayLabelLocale) =>
  formatStudentGenderLabel(asStr(value) || undefined, locale);

export const getGradeLabel = (value: unknown, locale: DisplayLabelLocale) =>
  formatDirectoryGradeLabel(asStr(value) || undefined, locale);

export const getSectionLabel = (value: unknown, locale: DisplayLabelLocale) =>
  formatStudentSectionLabel(asStr(value) || undefined, locale);

/** Result line (medal / rank / score / participation) from an achievement-shaped row */
export const getAchievementResultLabel = (
  row: Record<string, unknown>,
  locale: DisplayLabelLocale
) => formatResultLine(row, locale);

/** Stored event slug or internal key → human label */
export const getAchievementEventOrSlugLabel = (value: unknown, locale: DisplayLabelLocale) =>
  labelAchievementSlugOrKey(asStr(value) || undefined, locale);

const normKey = (s: string) => s.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");

const mechanicalLatinKeyToWords = (s: string): string =>
  s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

/** Last resort when no catalogued label exists */
export const humanizeRawKeyForDisplay = (value: unknown, locale: DisplayLabelLocale): string => {
  const s = asStr(value);
  if (!s) return locale === "ar" ? "غير محدد" : "Not specified";
  const k = normKey(s);
  const ev = getAchievementEventOrSlugLabel(s, locale);
  if (ev && ev !== "—" && normKey(ev) !== k) return ev;
  const d = getDisplayLabel(s, locale);
  if (d && d !== "—" && normKey(d) !== k) return d;
  if (/^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i.test(s)) return mechanicalLatinKeyToWords(s);
  if (s !== k && /^[a-z0-9_]+$/i.test(s)) return mechanicalLatinKeyToWords(s.replace(/_/g, "-"));
  return locale === "ar" ? "غير متوفر" : "Not available";
};

/**
 * Workflow distribution buckets from admin dashboard aggregation (donut / charts).
 * Not identical to DB `status` strings — includes synthetic `other`.
 */
export const getAdminDashboardWorkflowBucketLabel = (value: unknown, locale: DisplayLabelLocale): string => {
  const key = normKey(asStr(value));
  if (!key) return locale === "ar" ? "غير محدد" : "Not specified";
  const m: Record<string, { ar: string; en: string }> = {
    pending: { ar: "قيد المراجعة", en: "Pending review" },
    needs_revision: { ar: "يحتاج تعديل", en: "Needs revision" },
    pending_re_review: { ar: "تم التعديل / إعادة مراجعة", en: "Resubmitted / re-review" },
    approved: { ar: "معتمد", en: "Approved" },
    featured: { ar: "مميز", en: "Featured" },
    rejected: { ar: "مرفوض", en: "Rejected" },
    other: { ar: "أخرى", en: "Other" },
  };
  const row = m[key];
  if (row) return locale === "ar" ? row.ar : row.en;
  return humanizeRawKeyForDisplay(value, locale);
};

/** Committee / evidence verification line on student-facing surfaces */
export const getVerificationStatusLabel = (value: unknown, locale: DisplayLabelLocale): string => {
  const s = asStr(value);
  if (!s) return locale === "ar" ? "غير محدد" : "Not specified";
  const v = labelVerificationStatus(s, locale);
  if (v === "—" || v === s) return humanizeRawKeyForDisplay(s, locale);
  return v;
};

export const getEvidenceModeLabel = (value: unknown, locale: DisplayLabelLocale): string =>
  labelEvidenceMode(asStr(value) || undefined, locale);

/** Result kind only (medal/rank/participation…), not medal tier or rank place */
export const getResultTypeLabel = (value: unknown, locale: DisplayLabelLocale): string => {
  const s = asStr(value);
  if (!s) return locale === "ar" ? "غير محدد" : "Not specified";
  const v = labelResultType(s, locale);
  if (v === "—" || v === s) return humanizeRawKeyForDisplay(s, locale);
  return v;
};

/** Normalized AI / rules decision keys for admin & attachment review UIs */
export const getAiReviewDecisionLabel = (value: unknown, locale: DisplayLabelLocale): string => {
  const d = asStr(value).toLowerCase().replace(/\s+/g, "_");
  if (!d) return locale === "ar" ? "غير محدد" : "Not specified";
  const m: Record<string, { ar: string; en: string }> = {
    accepted: { ar: "مطابق", en: "Accepted" },
    accepted_with_warning: { ar: "مطابق مع ملاحظة", en: "Accepted with warning" },
    rejected: { ar: "غير مطابق", en: "Rejected" },
    unclear: { ar: "غير واضح", en: "Unclear" },
    match: { ar: "متطابق", en: "Match" },
    mismatch: { ar: "غير متطابق", en: "Mismatch" },
    pending: { ar: "قيد المراجعة", en: "Pending" },
    skipped: { ar: "تم التجاوز", en: "Skipped" },
  };
  const row = m[d];
  if (row) return locale === "ar" ? row.ar : row.en;
  return humanizeRawKeyForDisplay(value, locale);
};

/** Attachment / evidence checks: match | mismatch | unclear */
export const getTriStateMatchLabel = (value: unknown, locale: DisplayLabelLocale): string => {
  const s = asStr(value).toLowerCase();
  if (s === "match") return locale === "ar" ? "مطابق" : "Match";
  if (s === "mismatch") return locale === "ar" ? "غير مطابق" : "Mismatch";
  if (!s) return locale === "ar" ? "غير محدد" : "Not specified";
  return locale === "ar" ? "غير واضح" : "Unclear";
};

/** Background job state for attachment AI runs */
export const getAiReviewRunStatusLabel = (value: unknown, locale: DisplayLabelLocale): string => {
  const k = asStr(value).toLowerCase();
  if (!k) return locale === "ar" ? "غير محدد" : "Not specified";
  const m: Record<string, { ar: string; en: string }> = {
    idle: { ar: "جاهز", en: "Idle" },
    pending: { ar: "في الانتظار", en: "Pending" },
    processing: { ar: "قيد المعالجة", en: "Processing" },
    completed: { ar: "مكتمل", en: "Completed" },
    failed: { ar: "تعذّر التشغيل", en: "Failed" },
  };
  const row = m[k];
  if (row) return locale === "ar" ? row.ar : row.en;
  return humanizeRawKeyForDisplay(value, locale);
};

/** CMS news post workflow (not achievement workflow) */
export const getNewsEditorialStatusLabel = (value: unknown, locale: DisplayLabelLocale): string => {
  const k = asStr(value).toLowerCase();
  if (!k) return locale === "ar" ? "غير محدد" : "Not specified";
  const m: Record<string, { ar: string; en: string }> = {
    draft: { ar: "مسودة", en: "Draft" },
    pending_review: { ar: "قيد المراجعة", en: "Pending review" },
    approved: { ar: "معتمد", en: "Approved" },
    published: { ar: "منشور", en: "Published" },
    scheduled: { ar: "مجدول", en: "Scheduled" },
    failed: { ar: "فشل", en: "Failed" },
  };
  const row = m[k];
  if (row) return locale === "ar" ? row.ar : row.en;
  return humanizeRawKeyForDisplay(value, locale);
};

/** In-app notification type → short chip label */
export const getNotificationTypeLabel = (value: unknown, locale: DisplayLabelLocale): string => {
  const k = asStr(value);
  if (!k) return locale === "ar" ? "عام" : "General";
  const m: Record<string, { ar: string; en: string }> = {
    achievement_approved: { ar: "اعتماد", en: "Approved" },
    achievement_needs_revision: { ar: "تعديل مطلوب", en: "Revision" },
    achievement_rejected: { ar: "رفض", en: "Rejected" },
    achievement_deleted: { ar: "حذف", en: "Deleted" },
    achievement_featured: { ar: "تمييز", en: "Featured" },
    certificate_issued: { ar: "شهادة", en: "Certificate" },
    ai_flag_notice: { ar: "تنبيه مراجعة", en: "Review notice" },
    achievement_updated_for_review: { ar: "مراجعة مطلوبة", en: "Review required" },
    system: { ar: "عام", en: "System" },
  };
  const row = m[k];
  if (row) return locale === "ar" ? row.ar : row.en;
  return humanizeRawKeyForDisplay(k, locale);
};

/** Academic stage derived from grade buckets (reports / analytics) */
export const getReportStageLabel = (stage: string | undefined, locale: DisplayLabelLocale): string =>
  reportStageLabel((stage || "unknown") as ReportStage, locale === "ar");
