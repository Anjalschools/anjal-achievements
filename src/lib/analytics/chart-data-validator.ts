/**
 * Chart series validation — prevents Recharts silent failures from NaN/null keys.
 */

export type ChartSeriesPoint = {
  key: string;
  name: string;
  value: number;
  fill?: string;
  pct?: number;
};

export type ChartValidationResult = {
  ok: boolean;
  data: ChartSeriesPoint[];
  total: number;
  reason: "ok" | "empty" | "invalid_values";
};

const safeNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const validateChartSeries = (
  rows: Array<{ key?: string; name?: string; value?: unknown; count?: unknown; fill?: string }> | null | undefined
): ChartValidationResult => {
  if (!rows?.length) {
    return { ok: false, data: [], total: 0, reason: "empty" };
  }
  const data: ChartSeriesPoint[] = [];
  let invalid = false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const value = safeNum(r.value ?? r.count);
    if (r.value != null && !Number.isFinite(Number(r.value))) invalid = true;
    const key = String(r.key || `s${i}`).trim() || `s${i}`;
    data.push({
      key,
      name: String(r.name || key).trim() || key,
      value,
      fill: r.fill,
    });
  }
  const total = data.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    return { ok: false, data, total: 0, reason: "empty" };
  }
  const withPct = data.map((x) => ({
    ...x,
    pct: Math.round((x.value / total) * 1000) / 10,
  }));
  return {
    ok: !invalid,
    data: withPct,
    total,
    reason: invalid ? "invalid_values" : "ok",
  };
};

export const validateTrendSeries = (
  rows: Array<Record<string, unknown>> | null | undefined,
  numericKeys: string[]
): { ok: boolean; data: Array<Record<string, unknown>> } => {
  if (!rows?.length) return { ok: false, data: [] };
  const data = rows.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const k of numericKeys) {
      out[k] = safeNum(row[k]);
    }
    return out;
  });
  const hasAny = data.some((row) => numericKeys.some((k) => safeNum(row[k]) > 0));
  return { ok: hasAny, data };
};

export const chartEmptyMessage = (isAr: boolean): string =>
  isAr ? "لا توجد بيانات كافية" : "Not enough data to display";
