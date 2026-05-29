/**
 * Central drill-down router — maps chart/KPI interactions to filter patches + trace metadata.
 */

import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import {
  applyDrillDownToFilter,
  DRILL_RESULT_TOKENS,
  type AnalyticsDrillDownPatch,
  type AnalyticsTableViewMode,
} from "@/lib/analytics/analytics-drill-down";
import { buildAnalyticsTraceMeta, type AnalyticsTraceMeta } from "@/lib/analytics/analytics-traceability";
import { analyticsSearchParamsCanonicalString } from "@/lib/analytics/report-filter-url-sync";
import { buildParticipationFilterSearchParams } from "@/lib/analytics/participation-filter-params";

export type DrillChartSource =
  | "kpi"
  | "outcome_donut"
  | "outcome_bar"
  | "year_trend"
  | "section_card"
  | "section_bar"
  | "competition_row"
  | "competition_bar"
  | "activity_bar"
  | "activity_row"
  | "gender_bar"
  | "gender_stack"
  | "mawhiba_bar"
  | "std_test_row"
  | "medal_density"
  | "insight"
  | "ranking"
  | "historical_cell";

export type DrillDownTarget = {
  tableMode: AnalyticsTableViewMode;
  scrollToTable: boolean;
  /** Switch analytics tab when student-level view is required */
  preferStudentTab?: boolean;
  sectionId?: string;
};

export type DrillDownTrace = {
  traceId: string;
  timestamp: string;
  sourceChart: DrillChartSource;
  sourceKpi?: string;
  sourceMetric?: string;
  labelAr?: string;
  labelEn?: string;
  inheritedFilterHash: string;
  patch: AnalyticsDrillDownPatch;
};

export type DrillChartPayload = {
  key?: string;
  year?: number;
  labelAr?: string;
  labelEn?: string;
  activityKey?: string;
  competitionKey?: string;
  insightId?: string;
  metricKey?: string;
};

const OUTCOME_KEY_TO_TOKEN: Record<string, string> = {
  gold: DRILL_RESULT_TOKENS.gold,
  silver: DRILL_RESULT_TOKENS.silver,
  bronze: DRILL_RESULT_TOKENS.bronze,
  medal: DRILL_RESULT_TOKENS.medal,
  rank: DRILL_RESULT_TOKENS.rank,
  ranks: DRILL_RESULT_TOKENS.rank,
  nomination: DRILL_RESULT_TOKENS.nomination,
  participation: DRILL_RESULT_TOKENS.participation,
  qualification: "qualification",
  special_award: "special_award",
  recognition: "recognition",
  score: "score",
  completion: "completion",
};

const COMPETITION_PRIMARY_TYPES = new Set([
  "bebras",
  "kangaroo",
  "mawhiba",
  "kaust",
  "sat",
  "ielts",
]);

const genTraceId = (): string =>
  `dd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const mergeAnalyticsFilters = (
  current: ExecutiveFilterSnapshot,
  patch: AnalyticsDrillDownPatch
): ExecutiveFilterSnapshot => applyDrillDownToFilter(current, patch);

export const resolveDrillDownTarget = (
  source: DrillChartSource,
  payload: DrillChartPayload
): DrillDownTarget => {
  if (source === "insight" && payload.insightId?.includes("student")) {
    return { tableMode: "student", scrollToTable: true, preferStudentTab: true, sectionId: "analytics-table" };
  }
  if (source === "gender_stack" || source === "ranking") {
    return { tableMode: "detailed", scrollToTable: true, sectionId: "analytics-table" };
  }
  if (source === "year_trend") {
    return { tableMode: "detailed", scrollToTable: true, sectionId: "yoy" };
  }
  if (source === "competition_row" || source === "competition_bar" || source === "activity_row") {
    return { tableMode: "activity", scrollToTable: true, sectionId: "analytics-table" };
  }
  if (source === "std_test_row") {
    return { tableMode: "detailed", scrollToTable: true, sectionId: "std-tests" };
  }
  if (source === "kpi" && payload.metricKey === "distinctStudents") {
    return { tableMode: "student", scrollToTable: true, preferStudentTab: true, sectionId: "analytics-table" };
  }
  if (source === "historical_cell") {
    return { tableMode: "detailed", scrollToTable: true, sectionId: "analytics-table" };
  }
  return { tableMode: "detailed", scrollToTable: true, sectionId: "analytics-table" };
};

export const buildDrillDownFilters = (
  source: DrillChartSource,
  payload: DrillChartPayload,
  current: ExecutiveFilterSnapshot
): AnalyticsDrillDownPatch => {
  const key = String(payload.key || "").trim();
  const patch: AnalyticsDrillDownPatch = {};

  switch (source) {
    case "kpi": {
      const mk = payload.metricKey || key;
      if (mk === "totalParticipations" || mk === "total") {
        patch.tableMode = "summary";
      } else if (mk === "distinctStudents") {
        patch.tableMode = "student";
      } else if (mk === "goldMedalCount" || mk === "gold") {
        patch.resultTokens = [DRILL_RESULT_TOKENS.gold];
        patch.tableMode = "detailed";
      } else if (mk === "silver") {
        patch.resultTokens = [DRILL_RESULT_TOKENS.silver];
        patch.tableMode = "detailed";
      } else if (mk === "bronze") {
        patch.resultTokens = [DRILL_RESULT_TOKENS.bronze];
        patch.tableMode = "detailed";
      } else if (mk === "internationalAchievementPct" || mk === "international") {
        patch.sections = ["international"];
        patch.tableMode = "detailed";
      } else if (mk === "topProgram" && payload.labelEn) {
        patch.achievementNames = [payload.labelEn];
        patch.tableMode = "activity";
      } else if (mk === "topSection") {
        if (key === "international" || /دولي|international/i.test(payload.labelEn || "")) {
          patch.sections = ["international"];
        } else if (key === "arabic" || /عربي|arabic/i.test(payload.labelEn || "")) {
          patch.sections = ["arabic"];
        }
        patch.tableMode = "detailed";
      } else if (mk === "peakYear" && payload.year) {
        patch.activityYears = [String(payload.year)];
        patch.tableMode = "detailed";
      }
      break;
    }
    case "outcome_donut":
    case "outcome_bar": {
      const token = OUTCOME_KEY_TO_TOKEN[key] ?? (key ? `medal:${key}` : undefined);
      if (token) patch.resultTokens = [token];
      patch.tableMode = "detailed";
      break;
    }
    case "year_trend": {
      if (payload.year) patch.activityYears = [String(payload.year)];
      patch.tableMode = "detailed";
      break;
    }
    case "section_card":
    case "section_bar": {
      if (key === "arabic" || key === "international") {
        patch.sections = [key];
      } else if (key === "mawhiba") {
        patch.mawhibaValues = ["yes"];
      }
      patch.tableMode = "detailed";
      break;
    }
    case "competition_row":
    case "competition_bar": {
      const ck = payload.competitionKey || key;
      if (ck && COMPETITION_PRIMARY_TYPES.has(ck)) {
        patch.primaryType = ck;
      }
      if (ck === "sat" || ck === "ielts") {
        patch.standardizedTestTypes = [ck];
        patch.categories = [...new Set([...current.categories, "standardized_tests"])];
      }
      patch.tableMode = "activity";
      break;
    }
    case "activity_bar":
    case "activity_row": {
      const name = payload.labelEn || payload.labelAr || payload.activityKey;
      if (name) patch.achievementNames = [name];
      patch.tableMode = "activity";
      break;
    }
    case "gender_bar":
    case "gender_stack": {
      if (key === "male" || key === "female") patch.genders = [key];
      if (payload.metricKey === "gold") patch.resultTokens = [DRILL_RESULT_TOKENS.gold];
      else if (payload.metricKey === "silver") patch.resultTokens = [DRILL_RESULT_TOKENS.silver];
      else if (payload.metricKey === "bronze") patch.resultTokens = [DRILL_RESULT_TOKENS.bronze];
      else if (payload.metricKey === "ranks") patch.resultTokens = [DRILL_RESULT_TOKENS.rank];
      patch.tableMode = "detailed";
      break;
    }
    case "mawhiba_bar": {
      if (key === "yes" || key === "no") patch.mawhibaValues = [key];
      else patch.mawhibaValues = ["yes"];
      patch.tableMode = "detailed";
      break;
    }
    case "std_test_row": {
      const testKey = payload.competitionKey || key || payload.activityKey;
      if (testKey) {
        if (COMPETITION_PRIMARY_TYPES.has(testKey)) {
          patch.primaryType = testKey;
          patch.standardizedTestTypes = [testKey];
        } else {
          patch.achievementNames = [payload.labelEn || payload.labelAr || testKey].filter(Boolean) as string[];
        }
        patch.categories = [...new Set([...current.categories, "standardized_tests"])];
      }
      patch.tableMode = "detailed";
      break;
    }
    case "medal_density": {
      if (payload.activityKey || payload.labelEn) {
        patch.achievementNames = [payload.labelEn || payload.activityKey!].filter(Boolean);
      }
      patch.resultTokens = [DRILL_RESULT_TOKENS.medal];
      patch.tableMode = "detailed";
      break;
    }
    case "insight": {
      const id = payload.insightId || key;
      if (id?.includes("international")) patch.sections = ["international"];
      else if (id?.includes("female") || id?.includes("gender")) patch.genders = ["female"];
      else if (id?.includes("medal")) patch.resultTokens = [DRILL_RESULT_TOKENS.medal];
      else if (id?.includes("decline") || id?.includes("growth") || id?.includes("spike")) {
        patch.tableMode = "detailed";
      }
      break;
    }
    case "ranking":
      patch.tableMode = "summary";
      break;
    case "historical_cell": {
      const ck = payload.competitionKey || key;
      if (ck && COMPETITION_PRIMARY_TYPES.has(ck)) {
        patch.primaryType = ck;
      }
      if (payload.year) patch.activityYears = [String(payload.year)];
      if (payload.labelEn) patch.achievementNames = [payload.labelEn];
      const mk = payload.metricKey || "";
      if (mk === "gold") patch.resultTokens = [DRILL_RESULT_TOKENS.gold];
      else if (mk === "silver") patch.resultTokens = [DRILL_RESULT_TOKENS.silver];
      else if (mk === "bronze") patch.resultTokens = [DRILL_RESULT_TOKENS.bronze];
      else if (mk === "award_winners" || mk === "award_rate" || mk === "medal_rate") {
        patch.resultTokens = [DRILL_RESULT_TOKENS.medal];
      } else if (mk === "nomination" || mk === "qualification_rate" || mk === "qualified") {
        patch.resultTokens = [DRILL_RESULT_TOKENS.nomination];
      } else if (mk === "rankings" || mk === "first_place" || mk === "ranking_score") {
        patch.resultTokens = [DRILL_RESULT_TOKENS.rank];
      } else if (mk === "acceptance" || mk === "pass" || mk === "finalists") {
        patch.resultTokens = [DRILL_RESULT_TOKENS.nomination];
      } else if (mk === "participation") patch.resultTokens = [DRILL_RESULT_TOKENS.participation];
      patch.tableMode = "detailed";
      patch.focusTable = true;
      break;
    }
    default:
      break;
  }

  const target = resolveDrillDownTarget(source, payload);
  patch.tableMode = patch.tableMode ?? target.tableMode;
  return patch;
};

export const buildDrillDownTrace = (input: {
  source: DrillChartSource;
  payload: DrillChartPayload;
  current: ExecutiveFilterSnapshot;
  patch: AnalyticsDrillDownPatch;
  sourceKpi?: string;
  sourceMetric?: string;
}): DrillDownTrace => {
  const sp = buildParticipationFilterSearchParams(input.current);
  return {
    traceId: genTraceId(),
    timestamp: new Date().toISOString(),
    sourceChart: input.source,
    sourceKpi: input.sourceKpi,
    sourceMetric: input.sourceMetric ?? input.payload.metricKey,
    labelAr: input.payload.labelAr,
    labelEn: input.payload.labelEn,
    inheritedFilterHash: analyticsSearchParamsCanonicalString(sp),
    patch: input.patch,
  };
};

export type ApplyDrillDownFromChartResult = {
  patch: AnalyticsDrillDownPatch;
  mergedFilter: ExecutiveFilterSnapshot;
  target: DrillDownTarget;
  trace: DrillDownTrace;
  traceMeta: AnalyticsTraceMeta;
};

export const applyDrillDownFromChart = (
  source: DrillChartSource,
  payload: DrillChartPayload,
  current: ExecutiveFilterSnapshot
): ApplyDrillDownFromChartResult => {
  const patch = buildDrillDownFilters(source, payload, current);
  const mergedFilter = mergeAnalyticsFilters(current, patch);
  const target = resolveDrillDownTarget(source, payload);
  const trace = buildDrillDownTrace({
    source,
    payload,
    current,
    patch,
    sourceMetric: payload.metricKey,
  });
  const traceMeta = buildAnalyticsTraceMeta({
    searchParams: buildParticipationFilterSearchParams(mergedFilter),
    buildId: trace.traceId,
  });
  return { patch, mergedFilter, target, trace, traceMeta };
};
