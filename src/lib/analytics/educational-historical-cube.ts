/**
 * Educational Historical Cube — OLAP layer across years × dimensions.
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import type { AnalyticsCountPerspective } from "@/lib/analytics/analytics-perspective";
import { ACTIVITY_FAMILIES } from "@/lib/analytics/historical-comparison-table-engine";
import { ROW_CATEGORIES } from "@/lib/analytics/shared/historical-row-categories";
import { rowMatchesCategory } from "@/lib/analytics/shared/historical-row-matcher";
import { extractMetric } from "@/lib/analytics/shared/historical-metric-extract";
import { memoizeStrategic, strategicCacheKey } from "@/lib/analytics/analytics-strategic-cache";
import { normalizeDecimal } from "@/lib/analytics/analytics-number-formatting";

export type HistoricalCubeDimension =
  | "year"
  | "activity"
  | "gender"
  | "section"
  | "grade"
  | "talent";

export type HistoricalCubeMeasures = {
  participation: number;
  medals: number;
  qualification: number;
  acceptance: number;
  growth: number;
  equity: number;
  opportunity: number;
};

export type HistoricalCubeCell = {
  id: string;
  dimensions: Partial<Record<HistoricalCubeDimension, string>>;
  measures: HistoricalCubeMeasures;
};

export type EducationalHistoricalCube = {
  timelineId: string;
  years: number[];
  cells: HistoricalCubeCell[];
  totals: HistoricalCubeMeasures;
  perspective: AnalyticsCountPerspective;
};

const aggregateRows = (rows: ParticipationActivityRow[]): Omit<HistoricalCubeMeasures, "growth" | "equity" | "opportunity"> => {
  const participation = rows.reduce((s, r) => s + r.totalParticipations, 0);
  const medals = rows.reduce(
    (s, r) => s + r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount,
    0
  );
  const qualification = rows.reduce((s, r) => s + r.nominationCount, 0);
  const acceptance = rows.reduce((s, r) => s + r.approvedAchievements, 0);
  return { participation, medals, qualification, acceptance };
};

const enrichMeasures = (
  base: Omit<HistoricalCubeMeasures, "growth" | "equity" | "opportunity">,
  prev?: HistoricalCubeMeasures
): HistoricalCubeMeasures => {
  const growth =
    prev && prev.participation > 0
      ? normalizeDecimal(((base.participation - prev.participation) / prev.participation) * 100, 1)
      : 0;
  const intl = base.participation > 0 ? 50 : 0;
  return {
    ...base,
    growth,
    equity: normalizeDecimal(100 - intl, 1),
    opportunity: normalizeDecimal(
      base.participation * 0.4 + base.medals * 2 + base.acceptance * 1.5,
      1
    ),
  };
};

export const buildEducationalHistoricalCube = (
  slices: HistoricalYearSlice[],
  perspective: AnalyticsCountPerspective = "participation"
): EducationalHistoricalCube => {
  const years = slices.map((s) => s.year).sort((a, b) => a - b);
  const key = strategicCacheKey({
    y: years.join(","),
    p: perspective,
    t: String(slices.reduce((s, x) => s + x.payload.table.length, 0)),
  });

  return memoizeStrategic("cube", `hist-${key}`, () => {
    const cells: HistoricalCubeCell[] = [];
    let prevMeasures: HistoricalCubeMeasures | undefined;

    for (const slice of slices.sort((a, b) => a.year - b.year)) {
      const table = slice.payload.table;

      for (const family of ACTIVITY_FAMILIES) {
        const famRows = table.filter(family.match);
        if (famRows.length === 0) continue;
        const base = aggregateRows(famRows);
        const measures = enrichMeasures(base, prevMeasures);
        cells.push({
          id: `${slice.year}-${family.key}`,
          dimensions: { year: String(slice.year), activity: family.key },
          measures,
        });
        prevMeasures = measures;
      }

      for (const cat of ROW_CATEGORIES) {
        const catRows = table.filter((r) => rowMatchesCategory(r, cat));
        if (catRows.length === 0) continue;
        const base = aggregateRows(catRows);
        const measures = enrichMeasures(base);
        cells.push({
          id: `${slice.year}-${cat.key}`,
          dimensions: {
            year: String(slice.year),
            section: cat.section,
            grade: cat.stage,
          },
          measures,
        });
      }
    }

    const totals = cells.reduce<HistoricalCubeMeasures>(
      (acc, c) => ({
        participation: acc.participation + c.measures.participation,
        medals: acc.medals + c.measures.medals,
        qualification: acc.qualification + c.measures.qualification,
        acceptance: acc.acceptance + c.measures.acceptance,
        growth: normalizeDecimal(acc.growth + c.measures.growth, 1),
        equity: normalizeDecimal((acc.equity + c.measures.equity) / 2, 1),
        opportunity: normalizeDecimal(acc.opportunity + c.measures.opportunity, 1),
      }),
      {
        participation: 0,
        medals: 0,
        qualification: 0,
        acceptance: 0,
        growth: 0,
        equity: 0,
        opportunity: 0,
      }
    );

    return {
      timelineId: `timeline-${years.join("-")}`,
      years,
      cells,
      totals,
      perspective,
    };
  });
};

export const queryHistoricalCube = (
  cube: EducationalHistoricalCube,
  filter: Partial<Record<HistoricalCubeDimension, string>>
): HistoricalCubeCell[] =>
  cube.cells.filter((cell) =>
    Object.entries(filter).every(([dim, val]) => {
      if (!val) return true;
      return cell.dimensions[dim as HistoricalCubeDimension] === val;
    })
  );
