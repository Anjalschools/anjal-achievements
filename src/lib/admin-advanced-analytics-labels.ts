import { humanizeRawKeyForDisplay } from "@/lib/achievement-display-labels";
import { reportStageLabel } from "@/lib/report-stage-mapping";
import type { ReportStage } from "@/lib/report-stage-mapping";
import type { AnalyticsRecommendationCategory } from "@/lib/admin-advanced-analytics-types";

/** Human labels for admin advanced analytics (Arabic primary; English for sidebar parity). */

export const labelGenderKey = (key: string, isAr: boolean): string => {
  const k = String(key || "").toLowerCase();
  if (k === "male") return isAr ? "ذكور" : "Male";
  if (k === "female") return isAr ? "إناث" : "Female";
  return isAr ? "غير محدد" : "Unknown";
};

export const labelTrackKey = (key: string, isAr: boolean): string => {
  const k = String(key || "").toLowerCase();
  if (k === "arabic") return isAr ? "المسار العربي" : "Arabic track";
  if (k === "international") return isAr ? "المسار الدولي" : "International track";
  if (k === "unspecified") return isAr ? "غير محدد" : "Unspecified";
  return isAr ? "غير محدد" : "Unspecified";
};

export const labelStageKey = (key: string, isAr: boolean): string =>
  reportStageLabel((key || "unknown") as ReportStage, isAr);

export const labelStatusBucket = (key: string, isAr: boolean): string => {
  const k = String(key || "").toLowerCase();
  const m: Record<string, { ar: string; en: string }> = {
    pending: { ar: "قيد المراجعة", en: "Pending review" },
    needs_revision: { ar: "يحتاج تعديلاً", en: "Needs revision" },
    approved: { ar: "معتمد (غير مميز)", en: "Approved (not featured)" },
    featured: { ar: "معتمد ومميز", en: "Approved & featured" },
    rejected: { ar: "مرفوض", en: "Rejected" },
    pending_re_review: { ar: "بانتظار إعادة اعتماد", en: "Pending re-review" },
    other: { ar: "أخرى / غير مصنف", en: "Other / unclassified" },
  };
  const row = m[k];
  if (!row) return humanizeRawKeyForDisplay(key, isAr ? "ar" : "en");
  return isAr ? row.ar : row.en;
};

export const labelInsightPriority = (p: string | undefined, isAr: boolean): string => {
  const k = String(p || "").toLowerCase();
  if (k === "high") return isAr ? "مرتفعة" : "High";
  if (k === "medium") return isAr ? "متوسطة" : "Medium";
  if (k === "low") return isAr ? "منخفضة" : "Low";
  return isAr ? "غير محددة" : "Unspecified";
};

export const labelRecommendationCategory = (c: AnalyticsRecommendationCategory, isAr: boolean): string => {
  const m: Record<AnalyticsRecommendationCategory, { ar: string; en: string }> = {
    competition: { ar: "مسابقات", en: "Competitions" },
    program: { ar: "برامج", en: "Programs" },
    pathway: { ar: "مسارات", en: "Pathways" },
    timing: { ar: "توقيت", en: "Timing" },
    quality: { ar: "جودة", en: "Quality" },
    diversity: { ar: "تنوع", en: "Diversity" },
    strategy: { ar: "استراتيجية", en: "Strategy" },
  };
  return isAr ? m[c].ar : m[c].en;
};

export const labelRecommendationPriority = (p: "high" | "medium" | "low", isAr: boolean): string => {
  if (p === "high") return isAr ? "أولوية عالية" : "High priority";
  if (p === "medium") return isAr ? "أولوية متوسطة" : "Medium priority";
  return isAr ? "أولوية منخفضة" : "Low priority";
};
