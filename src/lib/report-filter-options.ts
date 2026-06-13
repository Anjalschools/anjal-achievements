import { getAchievementCategoryOptions } from "@/constants/achievement-ui-categories";
import { GRADE_OPTIONS } from "@/constants/grades";
import {
  getAchievementLevelLabel,
  labelAchievementCategory,
  labelLegacyAchievementType,
  labelMedal,
  labelRank,
  labelResultType,
} from "@/lib/achievementDisplay";
type Loc = "ar" | "en";

/** Values that may appear on achievementCategory or achievementType */
export const REPORT_CATEGORY_VALUES = [
  "competition",
  "program",
  "exhibition",
  "olympiad",
  "excellence_program",
  "qudrat",
  "mawhiba_annual",
  "gifted_discovery",
  "sat",
  "ielts",
  "toefl",
  "mawhiba",
  "gifted_screening",
  "standardized_tests",
  "early_university_admission",
  "entrepreneurship",
  "training_courses",
  "summer_training",
  "other",
] as const;

export type ReportCategoryValue = (typeof REPORT_CATEGORY_VALUES)[number];

const categoryLabel = (v: string, loc: Loc): string => {
  const c = labelAchievementCategory(v, loc);
  if (c && c !== "—") return c;
  return labelLegacyAchievementType(v, loc);
};

export const getReportCategoryOptions = (loc: Loc): Array<{ value: string; label: string }> => {
  const uiLabels = new Map<string, string>(
    getAchievementCategoryOptions(loc).map((o) => [o.value, o.label])
  );
  return [...REPORT_CATEGORY_VALUES].map((value) => ({
    value,
    label: uiLabels.get(value) ?? categoryLabel(value, loc),
  }));
};

/** DB achievementLevel enum */
export const REPORT_LEVEL_VALUES = ["school", "province", "kingdom", "international"] as const;

export const getReportLevelOptions = (loc: Loc): Array<{ value: string; label: string }> =>
  REPORT_LEVEL_VALUES.map((value) => ({
    value,
    label: getAchievementLevelLabel(value, loc),
  }));

/**
 * Result filter tokens (URL / state). Composite: `medal:gold`, `rank:first`.
 * Plain tokens match resultType only (e.g. `participation`).
 */
export const REPORT_RESULT_TOKEN_VALUES: string[] = [
  "participation",
  "nomination",
  "special_award",
  "recognition",
  "score",
  "completion",
  "other",
  "medal",
  "medal:gold",
  "medal:silver",
  "medal:bronze",
  "rank",
  "rank:first",
  "rank:second",
  "rank:third",
  "rank:fourth",
  "rank:fifth",
];

const resultTokenLabel = (token: string, loc: Loc): string => {
  if (token.includes(":")) {
    const [a, b] = token.split(":");
    if (a === "medal") {
      const m = labelMedal(b, loc);
      return loc === "ar" ? `ميدالية ${m}` : `${m} medal`;
    }
    if (a === "rank") {
      return labelRank(b, loc);
    }
  }
  if (token === "medal") return labelResultType("medal", loc);
  if (token === "rank") return labelResultType("rank", loc);
  return labelResultType(token, loc);
};

export const getReportResultOptions = (loc: Loc): Array<{ value: string; label: string }> =>
  REPORT_RESULT_TOKEN_VALUES.map((value) => ({
    value,
    label: resultTokenLabel(value, loc),
  }));

/** Standardized test type filter options (reports analytics). */
export const STANDARDIZED_TEST_TYPE_VALUES = [
  "qudrat",
  "tahsili",
  "sat",
  "ielts",
  "toefl",
  "step",
  "act",
  "mawhiba",
  "mawhiba_annual",
  "gifted_discovery",
  "gifted_screening",
  "qiyas",
  "language_test",
  "other",
] as const;

const standardizedTestTypeLabel = (v: string, loc: Loc): string => {
  const map: Record<string, { ar: string; en: string }> = {
    qudrat: { ar: "قدرات", en: "Qudrat" },
    tahsili: { ar: "تحصيلي", en: "Tahsili" },
    sat: { ar: "SAT", en: "SAT" },
    ielts: { ar: "IELTS", en: "IELTS" },
    toefl: { ar: "TOEFL", en: "TOEFL" },
    step: { ar: "STEP", en: "STEP" },
    act: { ar: "ACT", en: "ACT" },
    mawhiba: { ar: "موهبة", en: "Mawhiba" },
    mawhiba_annual: { ar: "موهبة السنوي", en: "Mawhiba annual" },
    gifted_discovery: { ar: "اكتشاف الموهوبين", en: "Gifted discovery" },
    gifted_screening: { ar: "الفرز الموهوب", en: "Gifted screening" },
    qiyas: { ar: "قياس", en: "Qiyas" },
    language_test: { ar: "اختبار لغة", en: "Language test" },
    other: { ar: "أخرى", en: "Other" },
  };
  return map[v]?.[loc] ?? v;
};

export const getStandardizedTestTypeOptions = (loc: Loc): Array<{ value: string; label: string }> =>
  STANDARDIZED_TEST_TYPE_VALUES.map((value) => ({
    value,
    label: standardizedTestTypeLabel(value, loc),
  }));

export const getReportGenderOptions = (loc: Loc): Array<{ value: string; label: string }> => [
  { value: "male", label: loc === "ar" ? "طلاب" : "Boys" },
  { value: "female", label: loc === "ar" ? "طالبات" : "Girls" },
];

export const getReportMawhibaOptions = (loc: Loc): Array<{ value: string; label: string }> => [
  { value: "yes", label: loc === "ar" ? "طلاب موهبة" : "Mawhiba students" },
  { value: "no", label: loc === "ar" ? "غير موهبة" : "Non‑Mawhiba" },
];

export const getReportStageOptions = (loc: Loc): Array<{ value: string; label: string }> => [
  { value: "primary", label: loc === "ar" ? "ابتدائي" : "Primary" },
  { value: "middle", label: loc === "ar" ? "متوسط" : "Middle" },
  { value: "secondary", label: loc === "ar" ? "ثانوي" : "Secondary" },
];

export const getReportGradeOptions = (loc: Loc): Array<{ value: string; label: string }> =>
  GRADE_OPTIONS.map((g) => ({ value: g.value, label: loc === "ar" ? g.ar : g.en }));

export const getReportStatusOptions = (loc: Loc): Array<{ value: string; label: string }> => [
  { value: "approved", label: loc === "ar" ? "معتمد" : "Approved" },
  { value: "pending", label: loc === "ar" ? "قيد المراجعة" : "Pending" },
  { value: "needs_revision", label: loc === "ar" ? "يحتاج تعديل" : "Needs revision" },
  { value: "rejected", label: loc === "ar" ? "مرفوض" : "Rejected" },
];

export const getReportCertificateStatusOptions = (loc: Loc): Array<{ value: string; label: string }> => [
  { value: "issued", label: loc === "ar" ? "صادرة" : "Issued" },
  { value: "not_issued", label: loc === "ar" ? "غير صادرة" : "Not issued" },
];

/** Map one result token to a Mongo sub-document condition (AND within token). */
/** Comma-separated list from query string; empty / "all" => no filter (الكل). */
export const parseReportCsvParam = (v: string | null | undefined): string[] => {
  const s = String(v ?? "").trim();
  if (!s || s === "all") return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
};

export const resultTokenToMongoCondition = (token: string): Record<string, unknown> | null => {
  const t = String(token || "").trim();
  if (!t) return null;
  if (t.includes(":")) {
    const [a, b] = t.split(":");
    if (a === "medal" && b) return { resultType: "medal", medalType: b };
    if (a === "rank" && b) return { resultType: "rank", rank: b };
  }
  if (t === "medal") return { resultType: "medal" };
  if (t === "rank") return { resultType: "rank" };
  if (
    ["participation", "nomination", "special_award", "recognition", "score", "completion", "other"].includes(t)
  ) {
    return { resultType: t };
  }
  return null;
};
