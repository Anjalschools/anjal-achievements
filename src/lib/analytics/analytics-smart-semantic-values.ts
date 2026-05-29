/**
 * Smart metric semantic display — when to show 0, —, N/A, exploratory, etc.
 */

import type { AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";
import { formatLocalizedNumber, formatPercentage } from "@/lib/analytics/analytics-number-formatting";
import { isRateMetric } from "@/lib/analytics/historical-results-metric-semantics";

export type SemanticDisplayKind =
  | "zero"
  | "dash"
  | "na"
  | "unknown"
  | "insufficient"
  | "not_applicable"
  | "hidden"
  | "exploratory"
  | "value";

export type SemanticValueContext = {
  metricKey: string;
  raw: number | null | undefined;
  loc?: AnalyticsLocale;
  isTotalRow?: boolean;
  hasYear?: boolean;
  explicitMissing?: boolean;
  /** Participation exists in scope but outcome metric is zero */
  hasParticipationScope?: boolean;
  /** Metric verified from outcome source (medals/rankings) */
  verifiedOutcomeSource?: boolean;
  /** Partial historical signal */
  exploratoryMode?: boolean;
  /** Rate columns on total row */
  aggregatable?: boolean;
  decimals?: number;
};

export type SmartSemanticResult = {
  kind: SemanticDisplayKind;
  numeric: number;
  display: string;
  isEmpty: boolean;
  isMissing: boolean;
  tooltipAr?: string;
  tooltipEn?: string;
};

export const EMPTY_DASH = "—";
export const EMPTY_NA = "N/A";

const formatCount = (n: number, loc: AnalyticsLocale, decimals: number): string =>
  formatLocalizedNumber(n, loc, decimals);

export const resolveSmartSemanticValue = (ctx: SemanticValueContext): SmartSemanticResult => {
  const loc = ctx.loc ?? "ar";
  const decimals = ctx.decimals ?? 0;
  const missing = ctx.explicitMissing === true || ctx.hasYear === false;
  const n =
    ctx.raw == null || !Number.isFinite(ctx.raw) || Number.isNaN(ctx.raw) ? null : ctx.raw;

  if (ctx.exploratoryMode && (n == null || n === 0)) {
    return {
      kind: "exploratory",
      numeric: 0,
      display: loc === "ar" ? "استكشافي" : "Exploratory",
      isEmpty: true,
      isMissing: false,
      tooltipAr: "إشارة تاريخية جزئية",
      tooltipEn: "Partial historical signal",
    };
  }

  if (missing) {
    return {
      kind: "dash",
      numeric: 0,
      display: EMPTY_DASH,
      isEmpty: true,
      isMissing: true,
      tooltipAr: "لا توجد بيانات لهذه السنة",
      tooltipEn: "No data for this year",
    };
  }

  if (/rank|ranking|first_place/i.test(ctx.metricKey) && !ctx.verifiedOutcomeSource) {
    return {
      kind: "hidden",
      numeric: 0,
      display: EMPTY_DASH,
      isEmpty: true,
      isMissing: false,
      tooltipAr: "مقياس مخفي بسبب عدم توفر مصدر ترتيب موثّق",
      tooltipEn: "Hidden because no verified rankings source exists",
    };
  }

  if (ctx.isTotalRow && ctx.aggregatable === false && isRateMetric(ctx.metricKey)) {
    return {
      kind: "na",
      numeric: 0,
      display: EMPTY_NA,
      isEmpty: true,
      isMissing: false,
      tooltipAr: "لا يُجمع عمود النسبة — يُعاد حسابه",
      tooltipEn: "Rate columns are recomputed, not summed",
    };
  }

  if (n == null) {
    if (ctx.isTotalRow && ctx.aggregatable === false) {
      return {
        kind: "na",
        numeric: 0,
        display: EMPTY_NA,
        isEmpty: true,
        isMissing: false,
      };
    }
    if (!isRateMetric(ctx.metricKey)) {
      return {
        kind: "unknown",
        numeric: 0,
        display: "0",
        isEmpty: true,
        isMissing: false,
      };
    }
    return {
      kind: "unknown",
      numeric: 0,
      display: EMPTY_DASH,
      isEmpty: true,
      isMissing: false,
    };
  }

  if (isRateMetric(ctx.metricKey)) {
    if (n <= 0 && !ctx.isTotalRow) {
      if (ctx.hasParticipationScope) {
        return {
          kind: "zero",
          numeric: 0,
          display: "0%",
          isEmpty: true,
          isMissing: false,
          tooltipAr: "مشاركة بدون نتيجة مسجّلة",
          tooltipEn: "Participation without recorded outcome",
        };
      }
      return {
        kind: "dash",
        numeric: 0,
        display: EMPTY_DASH,
        isEmpty: true,
        isMissing: false,
      };
    }
    return {
      kind: "value",
      numeric: n,
      display: formatPercentage(n, loc, { decimals: decimals || 1 }),
      isEmpty: n === 0,
      isMissing: false,
    };
  }

  if (n === 0) {
    if (!ctx.verifiedOutcomeSource && /gold|silver|bronze|award|rank|first_place|finalist/i.test(ctx.metricKey)) {
      return {
        kind: "not_applicable",
        numeric: 0,
        display: EMPTY_DASH,
        isEmpty: true,
        isMissing: false,
        tooltipAr: "لا يوجد مصدر نتائج موثّق",
        tooltipEn: "No verified outcome source",
      };
    }
    if (ctx.hasParticipationScope) {
      return {
        kind: "zero",
        numeric: 0,
        display: "0",
        isEmpty: true,
        isMissing: false,
        tooltipAr: "بيانات فعلية — صفر نتائج",
        tooltipEn: "Actual data — zero outcomes",
      };
    }
    return {
      kind: "dash",
      numeric: 0,
      display: EMPTY_DASH,
      isEmpty: true,
      isMissing: false,
    };
  }

  return {
    kind: "value",
    numeric: n,
    display: formatCount(n, loc, decimals),
    isEmpty: false,
    isMissing: false,
  };
};
