/**
 * Central multi-value analytics filter utilities.
 * Backward compatible: single legacy values auto-merge into arrays.
 */

export type MultiFilterValue = readonly string[];

const ALL_TOKENS = new Set(["", "all", "الكل"]);

export const normalizeMultiFilterValue = (
  input: string | string[] | number | number[] | null | undefined
): string[] => {
  if (input == null) return [];
  if (Array.isArray(input)) {
    return [...new Set(input.map((x) => String(x).trim()).filter((x) => x && !ALL_TOKENS.has(x)))];
  }
  const s = String(input).trim();
  if (!s || ALL_TOKENS.has(s)) return [];
  if (s.includes(",")) {
    return deserializeMultiFilter(s);
  }
  return [s];
};

export const normalizeNumericMultiFilter = (
  input: string | string[] | number | number[] | (string | number)[] | null | undefined,
  legacy?: string | number | null
): number[] => {
  const merged = [...normalizeMultiFilterValue(input as string | string[]), ...normalizeMultiFilterValue(legacy)];
  const out: number[] = [];
  for (const v of merged) {
    const n = Number(v);
    if (Number.isFinite(n)) out.push(Math.round(n));
  }
  return [...new Set(out)];
};

/** CSV serialization for query params. Empty array => omit param. */
export const serializeMultiFilter = (values: readonly string[]): string =>
  values.map((v) => String(v).trim()).filter(Boolean).join(",");

export const deserializeMultiFilter = (raw: string | null | undefined): string[] => {
  const s = String(raw ?? "").trim();
  if (!s || ALL_TOKENS.has(s)) return [];
  return [...new Set(s.split(",").map((x) => x.trim()).filter((x) => x && !ALL_TOKENS.has(x)))];
};

/** Merge plural CSV param with legacy singular param. */
export const deserializeMultiFilterWithLegacy = (
  plural: string | null | undefined,
  legacy: string | null | undefined
): string[] => {
  const a = deserializeMultiFilter(plural);
  const b = normalizeMultiFilterValue(legacy ?? undefined);
  return [...new Set([...a, ...b])];
};

export const isMultiFilterSelected = (values: readonly string[], item: string): boolean =>
  values.length === 0 || values.includes(item);

export const toggleMultiFilterValue = (values: readonly string[], item: string): string[] => {
  const set = new Set(values);
  if (set.has(item)) set.delete(item);
  else set.add(item);
  return [...set];
};

/** Build Mongo `{ field: { $in: [...] } }` or single equality when one value. */
export const buildMultiFilterMongoQuery = (
  field: string,
  values: readonly string[]
): Record<string, unknown> | null => {
  const v = values.map((x) => String(x).trim()).filter(Boolean);
  if (v.length === 0) return null;
  if (v.length === 1) return { [field]: v[0] };
  return { [field]: { $in: v } };
};

export const buildNumericMultiFilterMongoQuery = (
  field: string,
  values: readonly number[]
): Record<string, unknown> | null => {
  const v = values.filter((n) => Number.isFinite(n));
  if (v.length === 0) return null;
  if (v.length === 1) return { [field]: v[0] };
  return { [field]: { $in: v } };
};

/** Stable cache key for filter-dependent fetches. */
export const buildMultiFilterCacheKey = (parts: Record<string, unknown>): string =>
  JSON.stringify(parts, Object.keys(parts).sort());

export type ResolvedReportMultiFilters = {
  activityYears: number[];
  achievementNames: string[];
  stages: string[];
  grades: string[];
  genders: string[];
  mawhibaValues: string[];
  statuses: string[];
  certificateStatuses: string[];
  standardizedTestTypes: string[];
};

export type ReportMultiFilterInput = {
  activityYears?: (string | number)[];
  filterActivityYear?: string | number;
  achievementNames?: string[];
  achievementName?: string;
  stages?: string[];
  stage?: string;
  grades?: string[];
  grade?: string;
  genders?: string[];
  gender?: string;
  mawhibaValues?: string[];
  mawhiba?: string;
  statuses?: string[];
  status?: string;
  certificateStatuses?: string[];
  certificateStatus?: string;
  standardizedTestTypes?: string[];
};

const mergePluralWithLegacy = (
  plural: string[] | undefined,
  legacy: string | undefined
): string[] => {
  const a = plural ? normalizeMultiFilterValue(plural) : [];
  const b = normalizeMultiFilterValue(legacy);
  return [...new Set([...a, ...b])];
};

export const resolveReportMultiFilters = (input: ReportMultiFilterInput): ResolvedReportMultiFilters => ({
  activityYears: normalizeNumericMultiFilter(input.activityYears, input.filterActivityYear),
  achievementNames: mergePluralWithLegacy(input.achievementNames, input.achievementName),
  stages: mergePluralWithLegacy(input.stages, input.stage),
  grades: mergePluralWithLegacy(input.grades, input.grade),
  genders: mergePluralWithLegacy(input.genders, input.gender),
  mawhibaValues: mergePluralWithLegacy(input.mawhibaValues, input.mawhiba),
  statuses: mergePluralWithLegacy(input.statuses, input.status),
  certificateStatuses: mergePluralWithLegacy(input.certificateStatuses, input.certificateStatus),
  standardizedTestTypes: normalizeMultiFilterValue(input.standardizedTestTypes),
});
