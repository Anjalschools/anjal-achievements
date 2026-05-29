/**
 * Historical query resolution — cross-year compatible filters (not strict intersection).
 */

import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import { expandResultTokens } from "@/lib/analytics/historical-compatibility-registry";
import { stableAnalyticsHash } from "@/lib/analytics/analytics-historical-cache-v2";

const LOG = process.env.NODE_ENV !== "production";

export type HistoricalDimensionRelaxation = {
  droppedResultTokens: boolean;
  droppedLevels: boolean;
  droppedGrades: boolean;
  droppedAchievementNames: boolean;
  droppedClassification: boolean;
  reasonAr: string;
  reasonEn: string;
};

export type HistoricalCompatibleFilters = ExecutiveFilterSnapshot;

export type HistoricalQueryFingerprint = {
  hash: string;
  years: number[];
  dimensionKeys: string[];
  relaxed: boolean;
};

export const buildHistoricalDimensionRelaxation = (
  filter: ExecutiveFilterSnapshot,
  slices: HistoricalYearSlice[]
): HistoricalDimensionRelaxation => {
  const hasTable = slices.some((s) => s.payload.table.length > 0);
  const strictResult = filter.resultTokens.length > 0;
  const strictLevel = filter.levels.length > 0;

  const reasonsAr: string[] = [];
  const reasonsEn: string[] = [];

  if (strictResult) {
    reasonsAr.push("توسيع نتائج المشاركة عبر السنوات");
    reasonsEn.push("Expanded participation results across years");
  }
  if (strictLevel) {
    reasonsAr.push("تجاهل مستويات غير متوفرة في كل السنوات");
    reasonsEn.push("Ignored levels missing in some years");
  }
  if (!hasTable) {
    reasonsAr.push("بيانات جدولية محدودة");
    reasonsEn.push("Limited tabular data");
  }

  return {
    droppedResultTokens: strictResult,
    droppedLevels: strictLevel,
    droppedGrades: filter.grades.length > 0,
    droppedAchievementNames: filter.achievementNames.length > 0,
    droppedClassification: Boolean(filter.classification),
    reasonAr: reasonsAr.join(" · ") || "توافق تاريخي",
    reasonEn: reasonsEn.join(" · ") || "Historical compatibility",
  };
};

export const normalizeHistoricalFilterCompatibility = (
  filter: ExecutiveFilterSnapshot,
  relaxation: HistoricalDimensionRelaxation
): HistoricalCompatibleFilters => {
  const compatible: HistoricalCompatibleFilters = {
    ...filter,
    resultTokens: relaxation.droppedResultTokens ? [] : expandResultTokens(filter.resultTokens),
    levels: relaxation.droppedLevels ? [] : [...filter.levels],
    grades: relaxation.droppedGrades ? [] : [...filter.grades],
    achievementNames: relaxation.droppedAchievementNames ? [] : [...filter.achievementNames],
    classification: relaxation.droppedClassification ? "" : filter.classification,
  };

  if (LOG && (relaxation.droppedResultTokens || relaxation.droppedLevels)) {
    // eslint-disable-next-line no-console
    console.info("[historical-resolution] relaxed filters", {
      resultTokens: compatible.resultTokens.length,
      levels: compatible.levels.length,
    });
  }

  return compatible;
};

export const resolveHistoricalCompatibleFilters = (
  filter: ExecutiveFilterSnapshot,
  slices: HistoricalYearSlice[]
): {
  filter: HistoricalCompatibleFilters;
  relaxation: HistoricalDimensionRelaxation;
  fingerprint: HistoricalQueryFingerprint;
} => {
  const years = slices.map((s) => s.year).sort((a, b) => a - b);
  const relaxation = buildHistoricalDimensionRelaxation(filter, slices);
  const compatible = normalizeHistoricalFilterCompatibility(filter, relaxation);
  const relaxed =
    relaxation.droppedResultTokens ||
    relaxation.droppedLevels ||
    relaxation.droppedGrades;

  const fingerprint: HistoricalQueryFingerprint = {
    hash: stableAnalyticsHash({
      y: years.join(","),
      g: compatible.gender,
      r: compatible.resultTokens.join(","),
      l: compatible.levels.join(","),
      ay: compatible.activityYears.join(","),
      relaxed: relaxed ? "1" : "0",
    }),
    years,
    dimensionKeys: [
      ...(compatible.genders.length ? ["gender"] : []),
      ...(compatible.sections.length ? ["section"] : []),
      ...(compatible.resultTokens.length ? ["result"] : []),
    ],
    relaxed,
  };

  return { filter: compatible, relaxation, fingerprint };
};

export const buildHistoricalQueryFingerprint = (
  filter: ExecutiveFilterSnapshot,
  years: number[]
): HistoricalQueryFingerprint => {
  const y = [...years].sort((a, b) => a - b);
  return {
    hash: stableAnalyticsHash({
      y: y.join(","),
      ay: filter.activityYears.join(","),
      g: filter.gender,
    }),
    years: y,
    dimensionKeys: [],
    relaxed: false,
  };
};
