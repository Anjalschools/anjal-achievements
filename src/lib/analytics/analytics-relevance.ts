/**
 * Conditional relevance for KPIs and sections by competition scope.
 */

import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";

export type AnalyticsCompetitionScope = "local" | "national" | "international" | "mixed" | "unspecified";

const INTL_ACTIVITY_RE = /international|دولي|global|عالمي|imo|ib|igcse/i;
const LOCAL_ACTIVITY_RE = /bebras|بيبراس|kangaroo|كانجارو|mawhiba|موهبة|qudrat|قدرات|تحصيل/i;

export const resolveAnalyticsCompetitionScope = (f: ExecutiveFilterSnapshot): AnalyticsCompetitionScope => {
  const sections = f.sections.filter(Boolean);
  if (sections.length === 1 && sections[0] === "international") return "international";
  if (sections.length === 1 && sections[0] === "arabic") return "local";

  const names = [...f.achievementNames, f.primaryType !== "all" ? f.primaryType : ""].join(" ");
  const hasIntl = INTL_ACTIVITY_RE.test(names);
  const hasLocal = LOCAL_ACTIVITY_RE.test(names);

  if (hasIntl && !hasLocal) return "international";
  if (hasLocal && !hasIntl) return "local";
  if (hasIntl && hasLocal) return "mixed";
  if (f.achievementNames.length === 1) {
    const n = f.achievementNames[0]!;
    if (INTL_ACTIVITY_RE.test(n)) return "international";
    if (LOCAL_ACTIVITY_RE.test(n)) return "local";
  }
  return "unspecified";
};

export const shouldShowInternationalAchievementKpi = (
  scope: AnalyticsCompetitionScope,
  internationalAchievementPct: number,
  internationalSectionPct: number
): boolean => {
  if (scope === "local") return internationalAchievementPct > 0 || internationalSectionPct > 5;
  if (scope === "international") return true;
  return internationalAchievementPct > 0 || internationalSectionPct > 0;
};

export const shouldShowStdTestSection = (
  f: ExecutiveFilterSnapshot,
  stdTestRowCount: number
): boolean => {
  if (stdTestRowCount > 0) return true;
  if (f.standardizedTestTypes.length > 0) return true;
  if (f.categories.includes("standardized_tests")) return true;
  if (f.primaryType === "sat" || f.primaryType === "ielts") return true;
  return false;
};
