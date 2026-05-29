/**
 * Centralized number formatting — fixes floating precision leakage in analytics UI.
 */

import type { AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";

const EPSILON = 1e-9;

/** Normalize floating noise before display */
export const normalizeDecimal = (value: number, decimals = 2): number => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  const rounded = Math.round((value + EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
};

/** Executive rounding — whole numbers for KPIs when appropriate */
export const executiveRound = (value: number, threshold = 10): number => {
  const n = normalizeDecimal(value, 2);
  if (Math.abs(n) >= threshold) return Math.round(n);
  return normalizeDecimal(n, 1);
};

/** Percentage 0–100 with clean display */
export const formatPercentage = (
  value: number,
  loc: AnalyticsLocale = "ar",
  options?: { decimals?: number; compact?: boolean }
): string => {
  const decimals = options?.decimals ?? 1;
  const n = normalizeDecimal(Math.max(0, Math.min(100, value)), decimals);
  const formatted = n.toLocaleString(loc === "ar" ? "ar-SA" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
  return options?.compact ? `${formatted}%` : `${formatted}%`;
};

/** Safe percentage from ratio */
export const ratioToPercentage = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  return normalizeDecimal((numerator / denominator) * 100, 1);
};

/** General number with locale */
export const formatLocalizedNumber = (
  value: number,
  loc: AnalyticsLocale = "ar",
  decimals = 0
): string => {
  const n = normalizeDecimal(value, decimals);
  return n.toLocaleString(loc === "ar" ? "ar-SA" : "en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/** Compact notation for large counts (1.2K, 3.4M) */
export const formatCompactNumber = (value: number, loc: AnalyticsLocale = "ar"): string => {
  const n = normalizeDecimal(value, 2);
  return n.toLocaleString(loc === "ar" ? "ar-SA" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
};

/** Score display 0–100 */
export const formatScore = (score: number, loc: AnalyticsLocale = "ar"): string => {
  const n = Math.max(0, Math.min(100, Math.round(normalizeDecimal(score, 1))));
  return `${formatLocalizedNumber(n, loc, 0)}/100`;
};

/** Delta with sign */
export const formatSignedDelta = (
  delta: number,
  loc: AnalyticsLocale = "ar",
  suffix = ""
): string => {
  const n = normalizeDecimal(delta, 1);
  const sign = n > 0 ? "+" : "";
  return `${sign}${formatLocalizedNumber(n, loc, 1)}${suffix}`;
};

/** Fix legacy raw percentage strings */
export const sanitizeDisplayNumber = (raw: number | string): string => {
  if (typeof raw === "string") {
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed)) return raw;
    return formatPercentage(parsed);
  }
  if (raw > 0 && raw <= 1 && !Number.isInteger(raw)) {
    return formatPercentage(raw * 100);
  }
  if (raw <= 100 && raw >= 0) {
    return formatPercentage(raw);
  }
  return formatLocalizedNumber(normalizeDecimal(raw, 2));
};
