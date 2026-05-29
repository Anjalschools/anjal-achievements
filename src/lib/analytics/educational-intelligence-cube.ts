/**
 * Educational Intelligence Cube — lightweight OLAP layer over participation payloads.
 */

import type { ParticipationAnalyticsPayload, ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import type { AnalyticsCountPerspective } from "@/lib/analytics/analytics-perspective";
import { scaleSliceToPerspective } from "@/lib/analytics/analytics-perspective";
import {
  computeMetricFromPayload,
  formatMetricValue,
  getMetricDefinition,
  type MetricId,
  type CubeDimensionKey,
} from "@/lib/analytics/analytics-metric-registry";
import { memoizeStrategic, strategicCacheKey } from "@/lib/analytics/analytics-strategic-cache";
import { buildHistoricalTrendAnalysis } from "@/lib/analytics/historical-trend-engine";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import { projectForecast } from "@/lib/analytics/analytics-forecast-foundation";

export type CubePerspective = AnalyticsCountPerspective;

export type CubeDimensionFilter = Partial<Record<CubeDimensionKey, string>>;

export type CubeCell = {
  dimensions: Record<string, string>;
  measures: {
    participations: number;
    students: number;
    medals: number;
    nominations: number;
    acceptances: number;
    conversionPct: number;
  };
};

export type EducationalIntelligenceCube = {
  cells: CubeCell[];
  totals: CubeCell["measures"];
  perspective: CubePerspective;
  filterHash: string;
};

const aggregateRows = (rows: ParticipationActivityRow[]): CubeCell["measures"] => {
  const participations = rows.reduce((s, r) => s + r.totalParticipations, 0);
  const students = rows.reduce((s, r) => s + r.distinctParticipants, 0);
  const medals = rows.reduce(
    (s, r) => s + r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount,
    0
  );
  const nominations = rows.reduce((s, r) => s + r.nominationCount, 0);
  const acceptances = rows.reduce((s, r) => s + r.approvedAchievements, 0);
  return {
    participations,
    students,
    medals,
    nominations,
    acceptances,
    conversionPct: participations > 0 ? Math.round((medals / participations) * 1000) / 10 : 0,
  };
};

const rowMatchesFilter = (row: ParticipationActivityRow, filter: CubeDimensionFilter): boolean => {
  if (filter.gender === "male" && row.femaleParticipants > row.maleParticipants) return false;
  if (filter.gender === "female" && row.maleParticipants > row.femaleParticipants) return false;
  if (filter.section === "arabic" && row.internationalParticipants > row.arabicParticipants) return false;
  if (filter.section === "international" && row.arabicParticipants >= row.internationalParticipants) return false;
  if (filter.talentStatus === "yes" && row.nonMawhibaParticipants > row.mawhibaParticipants) return false;
  if (filter.talentStatus === "no" && row.mawhibaParticipants > row.nonMawhibaParticipants) return false;
  if (filter.level && row.levelKey !== filter.level) return false;
  if (filter.activity && !row.activityKey.includes(filter.activity) && !row.activityLabelEn.toLowerCase().includes(filter.activity.toLowerCase())) {
    return false;
  }
  return true;
};

export const buildIntelligenceCube = (
  data: ParticipationAnalyticsPayload,
  perspective: CubePerspective = "participation"
): EducationalIntelligenceCube => {
  const filterHash = strategicCacheKey({
    p: perspective,
    t: String(data.table.length),
    k: String(data.kpis.totalParticipations),
  });

  return memoizeStrategic("cube", filterHash, () => {
    const cells: CubeCell[] = [];

    const byActivity = new Map<string, ParticipationActivityRow[]>();
    for (const row of data.table) {
      const k = row.activityKey;
      const list = byActivity.get(k) ?? [];
      list.push(row);
      byActivity.set(k, list);
    }
    for (const [activity, rows] of byActivity) {
      cells.push({
        dimensions: { activity, achievementType: rows[0]!.typeKey },
        measures: aggregateRows(rows),
      });
    }

    for (const g of data.charts.genderParticipation) {
      const scaled = scaleSliceToPerspective(g.count, data, perspective);
      cells.push({
        dimensions: { gender: g.key },
        measures: {
          participations: scaled,
          students: scaled,
          medals: 0,
          nominations: 0,
          acceptances: 0,
          conversionPct: 0,
        },
      });
    }

    for (const s of data.charts.sectionParticipation) {
      const scaled = scaleSliceToPerspective(s.count, data, perspective);
      cells.push({
        dimensions: { section: s.key },
        measures: {
          participations: scaled,
          students: scaled,
          medals: 0,
          nominations: 0,
          acceptances: 0,
          conversionPct: 0,
        },
      });
    }

    for (const y of data.charts.yearTrend) {
      cells.push({
        dimensions: { year: String(y.year) },
        measures: {
          participations: y.totalRows,
          students: y.distinctStudents,
          medals: y.goldMedals,
          nominations: 0,
          acceptances: 0,
          conversionPct: y.totalRows > 0 ? Math.round((y.goldMedals / y.totalRows) * 1000) / 10 : 0,
        },
      });
    }

    const topAct = [...data.table].sort((a, b) => b.totalParticipations - a.totalParticipations)[0];
    const topShare =
      data.kpis.totalParticipations > 0 && topAct
        ? Math.round((topAct.totalParticipations / data.kpis.totalParticipations) * 1000) / 10
        : 0;

    const totals = {
      participations: data.kpis.totalParticipations,
      students: data.kpis.distinctStudents,
      medals: data.kpis.goldMedalCount + (data.table.reduce((s, r) => s + r.silverMedalCount + r.bronzeMedalCount, 0)),
      nominations: data.kpis.nominationCount,
      acceptances: data.table.reduce((s, r) => s + r.approvedAchievements, 0),
      conversionPct: computeMetricFromPayload("medal_conversion", {
        participations: data.kpis.totalParticipations,
        students: data.kpis.distinctStudents,
        medals: data.kpis.goldMedalCount,
        nominations: data.kpis.nominationCount,
        acceptances: data.table.reduce((s, r) => s + r.approvedAchievements, 0),
        topActivityShare: topShare,
      }),
    };

    return { cells, totals, perspective, filterHash };
  });
};

export const cubeSlice = (
  cube: EducationalIntelligenceCube,
  filter: CubeDimensionFilter
): EducationalIntelligenceCube => {
  const cells = cube.cells.filter((c) => {
    for (const [k, v] of Object.entries(filter)) {
      if (!v) continue;
      if (c.dimensions[k] !== v) return false;
    }
    return true;
  });
  const totals = cells.reduce(
    (acc, c) => ({
      participations: acc.participations + c.measures.participations,
      students: acc.students + c.measures.students,
      medals: acc.medals + c.measures.medals,
      nominations: acc.nominations + c.measures.nominations,
      acceptances: acc.acceptances + c.measures.acceptances,
      conversionPct: 0,
    }),
    {
      participations: 0,
      students: 0,
      medals: 0,
      nominations: 0,
      acceptances: 0,
      conversionPct: 0,
    }
  );
  totals.conversionPct =
    totals.participations > 0
      ? Math.round((totals.medals / totals.participations) * 1000) / 10
      : 0;
  return { ...cube, cells, totals };
};

/** Dice — multiple dimension filters (AND) */
export const cubeDice = cubeSlice;

export const cubePivot = (
  cube: EducationalIntelligenceCube,
  rowDim: CubeDimensionKey,
  colDim: CubeDimensionKey
): Record<string, Record<string, CubeCell["measures"]>> => {
  const grid: Record<string, Record<string, CubeCell["measures"]>> = {};
  for (const cell of cube.cells) {
    const row = cell.dimensions[rowDim] ?? "_";
    const col = cell.dimensions[colDim] ?? "_";
    if (!grid[row]) grid[row] = {};
    const prev = grid[row]![col];
    grid[row]![col] = prev
      ? {
          participations: prev.participations + cell.measures.participations,
          students: prev.students + cell.measures.students,
          medals: prev.medals + cell.measures.medals,
          nominations: prev.nominations + cell.measures.nominations,
          acceptances: prev.acceptances + cell.measures.acceptances,
          conversionPct: cell.measures.conversionPct,
        }
      : { ...cell.measures };
  }
  return grid;
};

export const cubeRollup = (cube: EducationalIntelligenceCube): CubeCell["measures"] => {
  return cube.cells.reduce(
    (acc, c) => ({
      participations: acc.participations + c.measures.participations,
      students: acc.students + c.measures.students,
      medals: acc.medals + c.measures.medals,
      nominations: acc.nominations + c.measures.nominations,
      acceptances: acc.acceptances + c.measures.acceptances,
      conversionPct: 0,
    }),
    {
      participations: 0,
      students: 0,
      medals: 0,
      nominations: 0,
      acceptances: 0,
      conversionPct: 0,
    }
  );
};

export const cubeMetric = (cube: EducationalIntelligenceCube, metricId: MetricId): number =>
  computeMetricFromPayload(metricId, {
    participations: cube.totals.participations,
    students: cube.totals.students,
    medals: cube.totals.medals,
    nominations: cube.totals.nominations,
    acceptances: cube.totals.acceptances,
    topActivityShare: computeMetricFromPayload("activity_concentration", {
      participations: cube.totals.participations,
      students: cube.totals.students,
      medals: cube.totals.medals,
      nominations: cube.totals.nominations,
      acceptances: cube.totals.acceptances,
    }),
  });

export const cubeDrilldown = (
  data: ParticipationAnalyticsPayload,
  filter: CubeDimensionFilter
): ParticipationActivityRow[] => data.table.filter((r) => rowMatchesFilter(r, filter));

export const cubeTrend = (
  slices: HistoricalYearSlice[],
  metricId: MetricId = "participation_count"
) => buildHistoricalTrendAnalysis(slices, metricId);

export const cubeCompare = (
  cubeA: EducationalIntelligenceCube,
  cubeB: EducationalIntelligenceCube,
  metricId: MetricId
): { valueA: number; valueB: number; delta: number; deltaPct: number } => {
  const valueA = cubeMetric(cubeA, metricId);
  const valueB = cubeMetric(cubeB, metricId);
  const delta = valueB - valueA;
  const base = Math.max(Math.abs(valueA), 1);
  return { valueA, valueB, delta, deltaPct: Math.round((delta / base) * 1000) / 10 };
};

export const cubeForecast = (
  series: Array<{ year: number; value: number }>,
  horizonYears = 1
) => projectForecast(series, horizonYears);

export const formatCubeMetric = (
  metricId: MetricId,
  value: number,
  loc: "ar" | "en" = "ar"
): string => formatMetricValue(metricId, value, loc);

export const cubeExportHeaders = (metricIds: MetricId[], loc: "ar" | "en"): string[] =>
  metricIds.map((id) => getMetricDefinition(id).exportLabel[loc]);
