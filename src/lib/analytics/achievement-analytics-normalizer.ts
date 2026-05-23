/**
 * Central analytics normalization — client-safe (no Mongo / server-only imports).
 * Used by consistency checks, chart validators, and payload reconciliation.
 */

import { resolveStoredAchievementReportCategory } from "@/lib/achievement-report-category";
import { REPORT_CATEGORY_VALUES } from "@/lib/report-filter-options";

export const ANALYTICS_COUNT_TOLERANCE_RATIO = 0.01;
export const ANALYTICS_COUNT_TOLERANCE_ABSOLUTE = 1;

const STANDARDIZED_DB_TYPES = new Set([
  "qudrat",
  "mawhiba_annual",
  "mawhiba",
  "gifted_discovery",
  "gifted_screening",
  "sat",
  "ielts",
  "toefl",
]);

const LEGACY_LEVEL_ALIASES: Record<string, string> = {
  global: "international",
  world: "international",
  governorate: "province",
  regional: "province",
};

export type AnalyticsAchievementRecord = {
  id?: string;
  achievementType?: string;
  achievementCategory?: string;
  achievementName?: string;
  customAchievementName?: string;
  description?: string;
  achievementLevel?: string;
  level?: string;
  resultType?: string;
  medalType?: string;
  rank?: string;
  userId?: string;
  participantId?: string;
};

export type NormalizedAnalyticsRecord = {
  id: string;
  analyticsCategory: string;
  dbAchievementType: string;
  analyticsLevel: string;
  resultToken: string;
  activityRawKey: string;
};

export const ciRoundCount = (n: number): number => Math.round(Number(n) || 0);

/** True when |expected − actual| is within ±1% or ±1 record (whichever is larger). */
export const countsWithinTolerance = (
  expected: number,
  actual: number,
  opts?: { ratio?: number; absolute?: number }
): boolean => {
  const exp = ciRoundCount(expected);
  const act = ciRoundCount(actual);
  if (exp === act) return true;
  const ratio = opts?.ratio ?? ANALYTICS_COUNT_TOLERANCE_RATIO;
  const absolute = opts?.absolute ?? ANALYTICS_COUNT_TOLERANCE_ABSOLUTE;
  const delta = Math.abs(exp - act);
  const allowed = Math.max(absolute, Math.ceil(Math.max(exp, act) * ratio));
  return delta <= allowed;
};

/** Canonical report category for analytics grouping / filters. */
export const resolveAnalyticsCategory = (doc: AnalyticsAchievementRecord): string => {
  const cat = resolveStoredAchievementReportCategory({
    achievementType: doc.achievementType,
    achievementCategory: doc.achievementCategory,
    achievementName: doc.achievementName,
    description: doc.description,
  });
  const c = String(cat || "").trim();
  if (c && (REPORT_CATEGORY_VALUES as readonly string[]).includes(c)) return c;
  const t = String(doc.achievementType || "").trim();
  if (STANDARDIZED_DB_TYPES.has(t)) return "standardized_tests";
  if (t === "exhibition") return "other";
  return c || t || "other";
};

export const resolveAnalyticsLevel = (doc: AnalyticsAchievementRecord): string => {
  const legacy = String(doc.level || "").trim().toLowerCase();
  if (legacy && LEGACY_LEVEL_ALIASES[legacy]) return LEGACY_LEVEL_ALIASES[legacy];
  const lvl = String(doc.achievementLevel || "").trim().toLowerCase();
  if (lvl && LEGACY_LEVEL_ALIASES[lvl]) return LEGACY_LEVEL_ALIASES[lvl];
  if (lvl === "international" || lvl === "kingdom" || lvl === "province" || lvl === "school") {
    return lvl;
  }
  return lvl || "school";
};

export const resolveAnalyticsResult = (doc: AnalyticsAchievementRecord): string => {
  const rt = String(doc.resultType || "").trim();
  if (rt === "medal") {
    const mt = String(doc.medalType || "").trim();
    return mt ? `medal:${mt}` : "medal";
  }
  if (rt === "rank") {
    const rk = String(doc.rank || "").trim();
    return rk ? `rank:${rk}` : "rank";
  }
  return rt || "participation";
};

export const normalizeAchievementAnalyticsRecord = (
  raw: AnalyticsAchievementRecord,
  index = 0
): NormalizedAnalyticsRecord | null => {
  const id = String(raw.id || raw.participantId || raw.userId || `row_${index}`).trim();
  if (!id) return null;
  const dbType = String(raw.achievementType || "").trim() || "other";
  const category = resolveAnalyticsCategory(raw);
  const name = String(raw.achievementName || raw.customAchievementName || "").trim();
  return {
    id,
    analyticsCategory: category,
    dbAchievementType: dbType,
    analyticsLevel: resolveAnalyticsLevel(raw),
    resultToken: resolveAnalyticsResult(raw),
    activityRawKey: name || dbType,
  };
};

/** Dedupe by id, drop invalid rows, unify categories/levels. */
export const normalizeAnalyticsDataset = (
  rows: AnalyticsAchievementRecord[]
): NormalizedAnalyticsRecord[] => {
  const seen = new Set<string>();
  const out: NormalizedAnalyticsRecord[] = [];
  rows.forEach((row, i) => {
    const n = normalizeAchievementAnalyticsRecord(row, i);
    if (!n) return;
    const dedupeKey = `${n.id}\u001f${n.analyticsCategory}\u001f${n.activityRawKey}\u001f${n.resultToken}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    out.push(n);
  });
  return out;
};

export type AnalyticsCanonicalDataset = {
  records: NormalizedAnalyticsRecord[];
  totalParticipations: number;
  distinctParticipantIds: number;
  byCategory: Map<string, number>;
  byResultToken: Map<string, number>;
};

export const buildAnalyticsCanonicalDataset = (
  rows: AnalyticsAchievementRecord[]
): AnalyticsCanonicalDataset => {
  const records = normalizeAnalyticsDataset(rows);
  const byCategory = new Map<string, number>();
  const byResultToken = new Map<string, number>();
  const participants = new Set<string>();
  for (const r of records) {
    byCategory.set(r.analyticsCategory, (byCategory.get(r.analyticsCategory) || 0) + 1);
    byResultToken.set(r.resultToken, (byResultToken.get(r.resultToken) || 0) + 1);
    participants.add(r.id);
  }
  return {
    records,
    totalParticipations: records.length,
    distinctParticipantIds: participants.size,
    byCategory,
    byResultToken,
  };
};

export type NormalizedParticipationCharts = {
  resultOutcomeSum: number;
  totalParticipations: number;
};

/** Reconcile general-tab KPI vs outcome chart totals after normalization. */
export const normalizeParticipationPayloadCounts = (input: {
  totalParticipations: number;
  resultOutcomeCompare: Array<{ count: number }>;
}): NormalizedParticipationCharts => {
  const resultOutcomeSum = input.resultOutcomeCompare.reduce(
    (s, x) => s + ciRoundCount(x.count),
    0
  );
  return {
    resultOutcomeSum,
    totalParticipations: ciRoundCount(input.totalParticipations),
  };
};

export type NormalizedFocusedCharts = {
  totalRecords: number;
  genderPieSum: number;
  sectionPieSum: number;
};

export const normalizeFocusedPayloadCounts = (input: {
  totalRecords: number;
  genderPie: Array<{ value: number }>;
  sectionPie: Array<{ value: number }>;
}): NormalizedFocusedCharts => ({
  totalRecords: ciRoundCount(input.totalRecords),
  genderPieSum: input.genderPie.reduce((s, x) => s + ciRoundCount(x.value), 0),
  sectionPieSum: input.sectionPie.reduce((s, x) => s + ciRoundCount(x.value), 0),
});

/** Compare filter snapshots for A/B mode — ignores activity-specific keys. */
export const comparableFilterSnapshot = (filters: Record<string, unknown> | undefined): string => {
  if (!filters || typeof filters !== "object") return "{}";
  const omit = new Set([
    "focusType",
    "focusRaw",
    "focusedOutcome",
    "activityFocusType",
    "activityFocusRaw",
  ]);
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(filters).sort()) {
    if (omit.has(k)) continue;
    const v = filters[k];
    if (v === undefined || v === null || v === "") continue;
    sorted[k] = v;
  }
  return JSON.stringify(sorted);
};

export type AnalyticsConsistencyDiagnostics = {
  expectedCount: number;
  actualCount: number;
  mismatchKeys: string[];
  staleSources: string[];
};

export const logAnalyticsConsistencyDebug = (
  label: string,
  diag: AnalyticsConsistencyDiagnostics
): void => {
  if (process.env.NODE_ENV === "production") return;
  if (typeof console === "undefined" || !console.debug) return;
  // eslint-disable-next-line no-console
  console.debug(`[analytics-consistency:${label}]`, diag);
};
