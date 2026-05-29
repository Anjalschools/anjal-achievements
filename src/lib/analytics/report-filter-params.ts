import type { AdminReportFilters } from "@/lib/achievement-admin-reports";
import { parseReportCsvParam } from "@/lib/report-filter-options";
import {
  deserializeMultiFilter,
  deserializeMultiFilterWithLegacy,
  normalizeNumericMultiFilter,
} from "@/lib/analytics/multi-filter-utils";

/** Parse unified report query params with CSV multi + legacy single-value support. */
export const parseAdminReportFiltersFromSearchParams = (
  searchParams: URLSearchParams
): AdminReportFilters => ({
  academicYear: String(searchParams.get("academicYear") || "").trim() || undefined,
  gender: String(searchParams.get("gender") || "").trim() || undefined,
  mawhiba: String(searchParams.get("mawhiba") || "").trim() || undefined,
  stage: String(searchParams.get("stage") || "").trim() || undefined,
  grade: String(searchParams.get("grade") || "").trim() || undefined,
  categories: parseReportCsvParam(searchParams.get("category")),
  achievementName: String(searchParams.get("achievementName") || "").trim() || undefined,
  achievementNames: deserializeMultiFilterWithLegacy(
    searchParams.get("achievementNames"),
    searchParams.get("achievementName")
  ),
  levels: parseReportCsvParam(searchParams.get("level")),
  resultTokens: parseReportCsvParam(
    searchParams.get("result") || searchParams.get("results") || searchParams.get("outcomes")
  ),
  status: String(searchParams.get("status") || "").trim() || undefined,
  statuses: deserializeMultiFilterWithLegacy(searchParams.get("statuses"), searchParams.get("status")),
  certificateStatus: String(searchParams.get("certificateStatus") || "").trim() || undefined,
  certificateStatuses: deserializeMultiFilterWithLegacy(
    searchParams.get("certificateStatuses"),
    searchParams.get("certificateStatus")
  ),
  genders: deserializeMultiFilterWithLegacy(searchParams.get("genders"), searchParams.get("gender")),
  mawhibaValues: deserializeMultiFilterWithLegacy(
    searchParams.get("mawhibaValues"),
    searchParams.get("mawhiba")
  ),
  stages: deserializeMultiFilterWithLegacy(searchParams.get("stages"), searchParams.get("stage")),
  grades: deserializeMultiFilterWithLegacy(searchParams.get("grades"), searchParams.get("grade")),
  activityYears: normalizeNumericMultiFilter(
    deserializeMultiFilter(searchParams.get("activityYears")),
    searchParams.get("filterActivityYear")
  ),
  filterActivityYear: String(searchParams.get("filterActivityYear") || "").trim() || undefined,
  standardizedTestTypes: deserializeMultiFilter(searchParams.get("standardizedTestTypes")),
  fromDate: String(searchParams.get("fromDate") || "").trim() || undefined,
  toDate: String(searchParams.get("toDate") || "").trim() || undefined,
  uniqueParticipantsOnly: searchParams.get("uniqueParticipantsOnly") === "1",
  scoreMin: (() => {
    const v = searchParams.get("scoreMin");
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  })(),
  scoreMax: (() => {
    const v = searchParams.get("scoreMax");
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  })(),
});

/** Build URLSearchParams for client fetch (multi CSV + legacy fallbacks omitted when empty). */
export const buildAdminReportSearchParams = (
  f: Record<string, unknown>
): URLSearchParams => {
  const params = new URLSearchParams({ view: "unified" });
  const set = (k: string, v: string) => {
    if (v) params.set(k, v);
  };

  set("academicYear", String(f.academicYear || ""));
  set("fromDate", String(f.fromDate || ""));
  set("toDate", String(f.toDate || ""));

  const categories = f.categories as string[] | undefined;
  if (categories?.length) set("category", categories.join(","));

  const levels = f.levels as string[] | undefined;
  if (levels?.length) set("level", levels.join(","));

  const resultTokens = f.resultTokens as string[] | undefined;
  if (resultTokens?.length) {
    const csv = resultTokens.join(",");
    set("result", csv);
    set("outcomes", csv);
  }

  const activityYears = f.activityYears as string[] | undefined;
  if (activityYears?.length) set("activityYears", activityYears.join(","));

  const achievementNames = f.achievementNames as string[] | undefined;
  if (achievementNames?.length) set("achievementNames", achievementNames.join(","));

  const stages = f.stages as string[] | undefined;
  if (stages?.length) set("stages", stages.join(","));

  const grades = f.grades as string[] | undefined;
  if (grades?.length) set("grades", grades.join(","));

  const genders = f.genders as string[] | undefined;
  if (genders?.length) set("genders", genders.join(","));

  const mawhibaValues = f.mawhibaValues as string[] | undefined;
  if (mawhibaValues?.length) set("mawhibaValues", mawhibaValues.join(","));

  const statuses = f.statuses as string[] | undefined;
  if (statuses?.length) set("statuses", statuses.join(","));

  const certificateStatuses = f.certificateStatuses as string[] | undefined;
  if (certificateStatuses?.length) set("certificateStatuses", certificateStatuses.join(","));

  const standardizedTestTypes = f.standardizedTestTypes as string[] | undefined;
  if (standardizedTestTypes?.length) set("standardizedTestTypes", standardizedTestTypes.join(","));

  if (f.uniqueParticipantsOnly) set("uniqueParticipantsOnly", "1");
  if (f.scoreMin !== "" && f.scoreMin != null) set("scoreMin", String(f.scoreMin));
  if (f.scoreMax !== "" && f.scoreMax != null) set("scoreMax", String(f.scoreMax));

  return params;
};

/** Fetch params for option endpoints (no `view` key). */
export const buildReportOptionFetchParams = (
  f: Record<string, unknown>
): Record<string, string> => {
  const params = buildAdminReportSearchParams(f);
  params.delete("view");
  const out: Record<string, string> = {};
  params.forEach((v, k) => {
    out[k] = v;
  });
  out.academicYear = String(f.academicYear || "2025-2026م");
  return out;
};

export type ReportFilterUiState = {
  academicYear: string;
  categories: string[];
  achievementNames: string[];
  activityYears: string[];
  genders: string[];
  mawhibaValues: string[];
  stages: string[];
  grades: string[];
  levels: string[];
  resultTokens: string[];
  statuses: string[];
  certificateStatuses: string[];
  standardizedTestTypes: string[];
  uniqueParticipantsOnly: boolean;
  fromDate: string;
  toDate: string;
  scoreMin: string | number;
  scoreMax: string | number;
};

export const defaultReportFilterUiState = (): ReportFilterUiState => ({
  academicYear: "2025-2026م",
  categories: [],
  achievementNames: [],
  activityYears: [],
  genders: [],
  mawhibaValues: [],
  stages: [],
  grades: [],
  levels: [],
  resultTokens: [],
  statuses: [],
  certificateStatuses: [],
  standardizedTestTypes: [],
  uniqueParticipantsOnly: false,
  fromDate: "",
  toDate: "",
  scoreMin: "",
  scoreMax: "",
});
