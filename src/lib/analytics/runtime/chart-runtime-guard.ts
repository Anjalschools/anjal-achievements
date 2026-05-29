/**
 * Chart runtime guard — validates datasets before Recharts mount; logs invalid payloads in debug.
 */

export type ChartGuardReason = "ok" | "empty" | "invalid_values" | "missing_keys";

export type ChartGuardResult<T> = {
  ok: boolean;
  data: T;
  reason: ChartGuardReason;
  total?: number;
};

const isDebugCharts = (): boolean =>
  typeof process !== "undefined" &&
  (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1");

export const logExecutiveChartDataInvalid = (params: {
  chartId: string;
  reason: ChartGuardReason;
  payloadShape?: string;
  invalidKeys?: string[];
}): void => {
  if (!isDebugCharts()) return;
  console.warn("[EXECUTIVE_CHART_DATA_INVALID]", {
    chartId: params.chartId,
    reason: params.reason,
    payloadShape: params.payloadShape,
    invalidKeys: params.invalidKeys,
  });
};

const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export const validateStackedGenderSeries = (
  chartId: string,
  rows: Array<{ name?: string; male?: unknown; female?: unknown }> | null | undefined
): ChartGuardResult<Array<{ name: string; male: number; female: number }>> => {
  if (!rows?.length) {
    logExecutiveChartDataInvalid({
      chartId,
      reason: "empty",
      payloadShape: "stackedGender[]",
    });
    return { ok: false, data: [], reason: "empty" };
  }

  const data: Array<{ name: string; male: number; female: number }> = [];
  const invalidKeys: string[] = [];

  rows.forEach((row, i) => {
    const male = safeNum(row.male);
    const female = safeNum(row.female);
    if (!Number.isFinite(male) || !Number.isFinite(female)) {
      invalidKeys.push(`row${i}`);
    }
    data.push({
      name: String(row.name ?? `s${i}`).trim() || `s${i}`,
      male: Number.isFinite(male) ? male : 0,
      female: Number.isFinite(female) ? female : 0,
    });
  });

  const total = data.reduce((s, r) => s + r.male + r.female, 0);
  if (total <= 0) {
    logExecutiveChartDataInvalid({
      chartId,
      reason: "empty",
      payloadShape: `stackedGender[${data.length}]`,
    });
    return { ok: false, data, reason: "empty", total: 0 };
  }

  if (invalidKeys.length) {
    logExecutiveChartDataInvalid({
      chartId,
      reason: "invalid_values",
      invalidKeys,
    });
    return { ok: false, data, reason: "invalid_values", total };
  }

  return { ok: true, data, reason: "ok", total };
};

export const validateCountBarSeries = (
  chartId: string,
  rows: Array<{ name?: string; n?: unknown; count?: unknown }> | null | undefined,
  valueKey: "n" | "count" = "n"
): ChartGuardResult<Array<{ name: string; n: number }>> => {
  if (!rows?.length) {
    logExecutiveChartDataInvalid({
      chartId,
      reason: "empty",
      payloadShape: "countBar[]",
    });
    return { ok: false, data: [], reason: "empty" };
  }

  const data = rows.map((row, i) => {
    const raw = valueKey === "n" ? row.n : row.count;
    const n = safeNum(raw);
    return {
      name: String(row.name ?? `s${i}`).trim() || `s${i}`,
      n: Number.isFinite(n) ? n : 0,
    };
  });

  const total = data.reduce((s, r) => s + r.n, 0);
  if (total <= 0) {
    logExecutiveChartDataInvalid({ chartId, reason: "empty" });
    return { ok: false, data, reason: "empty", total: 0 };
  }

  return { ok: true, data, reason: "ok", total };
};

export { ensureChartArray, ensureSeriesIntegrity, sanitizeNumericSeries } from "@/lib/analytics/focused-chart-validation";

export const chartGuardEmptyMessage = (
  isAr: boolean,
  reason: ChartGuardReason
): string => {
  if (reason === "invalid_values") {
    return isAr ? "بيانات الرسم غير صالحة" : "Chart data is invalid";
  }
  return isAr ? "لا توجد بيانات كافية — جرّب توسيع الفلاتر" : "Not enough data — try widening filters";
};
