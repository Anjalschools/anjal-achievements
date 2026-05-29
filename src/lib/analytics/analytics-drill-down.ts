/**
 * Shared drill-down patches — apply to ExecutiveFilterSnapshot without rebuilding filters manually.
 */

import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";

export type AnalyticsTableViewMode = "summary" | "activity" | "detailed" | "student";

export type AnalyticsDrillDownPatch = {
  resultTokens?: string[];
  categories?: string[];
  sections?: string[];
  activityYears?: string[];
  achievementNames?: string[];
  primaryType?: string;
  levels?: string[];
  genders?: string[];
  mawhibaValues?: string[];
  standardizedTestTypes?: string[];
  tableMode?: AnalyticsTableViewMode;
  /** Scroll analytics table into view after apply */
  focusTable?: boolean;
};

export const DRILL_RESULT_TOKENS = {
  gold: "medal:gold",
  silver: "medal:silver",
  bronze: "medal:bronze",
  medal: "medal",
  rank: "rank",
  nomination: "nomination",
  participation: "participation",
} as const;

export const applyDrillDownToFilter = (
  filter: ExecutiveFilterSnapshot,
  patch: AnalyticsDrillDownPatch
): ExecutiveFilterSnapshot => ({
  ...filter,
  ...(patch.resultTokens !== undefined ? { resultTokens: [...patch.resultTokens] } : {}),
  ...(patch.categories !== undefined ? { categories: [...patch.categories] } : {}),
  ...(patch.sections !== undefined ? { sections: [...patch.sections] } : {}),
  ...(patch.activityYears !== undefined ? { activityYears: [...patch.activityYears] } : {}),
  ...(patch.achievementNames !== undefined ? { achievementNames: [...patch.achievementNames] } : {}),
  ...(patch.primaryType !== undefined ? { primaryType: patch.primaryType } : {}),
  ...(patch.levels !== undefined ? { levels: [...patch.levels] } : {}),
  ...(patch.genders !== undefined ? { genders: [...patch.genders] } : {}),
  ...(patch.mawhibaValues !== undefined ? { mawhibaValues: [...patch.mawhibaValues] } : {}),
  ...(patch.standardizedTestTypes !== undefined ?
    { standardizedTestTypes: [...patch.standardizedTestTypes] }
  : {}),
});

export const scrollAnalyticsTableIntoView = (): void => {
  if (typeof document === "undefined") return;
  const el = document.getElementById("analytics-data-table");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
};
