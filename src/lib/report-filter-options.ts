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
  "other",
] as const;

export type ReportCategoryValue = (typeof REPORT_CATEGORY_VALUES)[number];

const categoryLabel = (v: string, loc: Loc): string => {
  const c = labelAchievementCategory(v, loc);
  if (c && c !== "—") return c;
  return labelLegacyAchievementType(v, loc);
};

export const getReportCategoryOptions = (loc: Loc): Array<{ value: string; label: string }> =>
  [...REPORT_CATEGORY_VALUES].map((value) => ({
    value,
    label: categoryLabel(value, loc),
  }));

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
