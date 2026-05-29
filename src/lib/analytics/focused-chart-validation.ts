/**
 * Chart data validation — prevents [EXECUTIVE_CHART_DATA_INVALID] from malformed facet payloads.
 */

import type { FocusedActivityReportPayload } from "@/types/focused-activity-report";
import { logExecutiveChartDataInvalid } from "@/lib/analytics/runtime/chart-runtime-guard";
import { MAX_CHART_SERIES_POINTS } from "@/lib/analytics/focused-full-guards";

const safeNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Ensure value is a bounded array (never pass giant or non-array to Recharts). */
export const ensureChartArray = <T extends Record<string, unknown>>(
  value: unknown,
  chartId: string
): T[] => {
  if (!Array.isArray(value)) {
    logExecutiveChartDataInvalid({
      chartId,
      reason: "invalid_values",
      payloadShape: typeof value,
    });
    return [];
  }
  const arr = value as T[];
  if (arr.length > MAX_CHART_SERIES_POINTS) {
    logExecutiveChartDataInvalid({
      chartId,
      reason: "invalid_values",
      payloadShape: `array[${arr.length}]`,
    });
    return arr.slice(0, MAX_CHART_SERIES_POINTS);
  }
  return arr;
};

type PieRow = { name: string; nameAr: string; nameEn: string; value: number };

/** Validate pie row keys and numeric integrity (preserves bilingual labels). */
export const ensureSeriesIntegrity = (
  chartId: string,
  rows: Array<{ name?: unknown; nameAr?: unknown; nameEn?: unknown; value?: unknown; count?: unknown }>
): PieRow[] =>
  ensureChartArray(rows, chartId).map((row, i) => ({
    name: String(row.name ?? `s${i}`).trim() || `s${i}`,
    nameAr: String(row.nameAr ?? row.name ?? `s${i}`).trim() || `s${i}`,
    nameEn: String(row.nameEn ?? row.name ?? `s${i}`).trim() || `s${i}`,
    value: safeNum(row.value ?? row.count, 0),
  }));

export const sanitizeNumericSeries = (
  chartId: string,
  rows: Array<Record<string, unknown>>,
  numericKeys: string[]
): Array<Record<string, unknown>> =>
  ensureChartArray(rows, chartId).map((row, i) => {
    const out: Record<string, unknown> = {
      ...row,
      name: String(row.name ?? `s${i}`).trim() || `s${i}`,
    };
    for (const key of numericKeys) {
      out[key] = safeNum(row[key], 0);
    }
    return out;
  });

export const sanitizeFocusedChartsPayload = (
  charts: FocusedActivityReportPayload["charts"]
): FocusedActivityReportPayload["charts"] => ({
  resultBars: ensureChartArray<Record<string, unknown>>(charts?.resultBars ?? [], "focused-result-bars").map((bar) => ({
    key: String((bar as { key?: string }).key ?? ""),
    labelAr: String((bar as { labelAr?: string }).labelAr ?? ""),
    labelEn: String((bar as { labelEn?: string }).labelEn ?? ""),
    count: safeNum((bar as { count?: unknown }).count, 0),
    fill: String((bar as { fill?: string }).fill ?? "#2563EB"),
  })),
  genderPie: ensureSeriesIntegrity("focused-gender-pie", charts?.genderPie ?? []),
  sectionPie: ensureSeriesIntegrity("focused-section-pie", charts?.sectionPie ?? []),
  mawhibaPie: ensureSeriesIntegrity("focused-mawhiba-pie", charts?.mawhibaPie ?? []),
  yearTrend: sanitizeNumericSeries(
    "focused-year-trend",
    ensureChartArray<Record<string, unknown>>(charts?.yearTrend ?? [], "focused-year-trend"),
    [
      "year",
      "records",
      "distinctStudents",
      "goldMedals",
      "silverMedals",
      "bronzeMedals",
      "totalMedals",
      "excellenceRatePct",
      "maxLevelRank",
    ]
  ).map((row, i) => {
    const y = row as Record<string, unknown>;
    const source = (charts?.yearTrend ?? [])[i] as Record<string, unknown> | undefined;
    return {
      year: safeNum(y.year, 0),
      records: safeNum(y.records, 0),
      distinctStudents: safeNum(y.distinctStudents, 0),
      goldMedals: safeNum(y.goldMedals, 0),
      silverMedals: safeNum(y.silverMedals, 0),
      bronzeMedals: safeNum(y.bronzeMedals, 0),
      totalMedals: safeNum(y.totalMedals, 0),
      excellenceRatePct: safeNum(y.excellenceRatePct, 0),
      maxLevelRank: safeNum(y.maxLevelRank, 2),
      topLevelLabelAr: String(source?.topLevelLabelAr ?? ""),
      topLevelLabelEn: String(source?.topLevelLabelEn ?? ""),
    };
  }),
});
