/**
 * Historical Educational Intelligence Registry — unified semantics for timeline analytics.
 */

import type { MetricId } from "@/lib/analytics/analytics-metric-registry";
import type { TrendSemantic } from "@/lib/analytics/analytics-metric-registry";

export type HistoricalMetricId =
  | "participation_count"
  | "medal_count"
  | "qualification_rate"
  | "acceptance_rate"
  | "talent_growth"
  | "equity_gap"
  | "opportunity_score"
  | "medal_conversion"
  | "historical_growth";

export type HistoricalAggregationStrategy =
  | "sum"
  | "average"
  | "weighted_average"
  | "ratio"
  | "max"
  | "min";

export type HistoricalTrendStrategy =
  | "cagr"
  | "rolling_growth"
  | "momentum"
  | "peak_detection"
  | "volatility_band"
  | "consistency_index";

export type HistoricalSeverity = "ok" | "info" | "warning" | "critical";

export type HeatmapIntensityMode = "growth" | "decline" | "stability" | "representation" | "medals";

export type HistoricalMetricDefinition = {
  id: HistoricalMetricId;
  tableMetricKey?: string;
  linkedMetricId?: MetricId;
  label: { ar: string; en: string };
  aggregation: HistoricalAggregationStrategy;
  trendStrategies: HistoricalTrendStrategy[];
  volatilitySensitivity: number;
  cagrEligible: boolean;
  peakDetection: boolean;
  consistencyThresholds: { stable: number; volatile: number };
  executiveInterpretation: {
    strongGrowth: { ar: string; en: string };
    decline: { ar: string; en: string };
    volatile: { ar: string; en: string };
    stable: { ar: string; en: string };
  };
  exportWording: { ar: string; en: string };
  heatmapMode: HeatmapIntensityMode;
  severity: { warnCagr: number; criticalCagr: number; warnVolatility: number };
};

const def = (
  partial: Omit<HistoricalMetricDefinition, "trendStrategies"> & {
    trendStrategies?: HistoricalTrendStrategy[];
  }
): HistoricalMetricDefinition => ({
  trendStrategies: ["cagr", "rolling_growth", "momentum", "peak_detection", "consistency_index"],
  ...partial,
});

export const HISTORICAL_INTELLIGENCE_REGISTRY: Record<HistoricalMetricId, HistoricalMetricDefinition> = {
  participation_count: def({
    id: "participation_count",
    tableMetricKey: "participation",
    linkedMetricId: "participation_count",
    label: { ar: "المشاركات", en: "Participations" },
    aggregation: "sum",
    volatilitySensitivity: 0.35,
    cagrEligible: true,
    peakDetection: true,
    consistencyThresholds: { stable: 72, volatile: 45 },
    executiveInterpretation: {
      strongGrowth: { ar: "نمو مشاركة مستدام", en: "Sustained participation growth" },
      decline: { ar: "تراجع مشاركة متكرر", en: "Recurring participation decline" },
      volatile: { ar: "تقلب مرتفع في المشاركة", en: "High participation volatility" },
      stable: { ar: "استقرار مشاركة عالي", en: "High participation stability" },
    },
    exportWording: { ar: "المشاركات التاريخية", en: "Historical participations" },
    heatmapMode: "growth",
    severity: { warnCagr: -8, criticalCagr: -18, warnVolatility: 55 },
  }),
  medal_count: def({
    id: "medal_count",
    tableMetricKey: "gold",
    label: { ar: "الميداليات", en: "Medals" },
    aggregation: "sum",
    volatilitySensitivity: 0.5,
    cagrEligible: true,
    peakDetection: true,
    consistencyThresholds: { stable: 65, volatile: 40 },
    executiveInterpretation: {
      strongGrowth: { ar: "تصاعد ميدالي", en: "Medal momentum rising" },
      decline: { ar: "انهيار ميدالي", en: "Medal collapse" },
      volatile: { ar: "تقلب ميدالي", en: "Medal volatility" },
      stable: { ar: "إنتاج ميدالي مستقر", en: "Stable medal output" },
    },
    exportWording: { ar: "الميداليات", en: "Medals" },
    heatmapMode: "medals",
    severity: { warnCagr: -10, criticalCagr: -25, warnVolatility: 60 },
  }),
  qualification_rate: def({
    id: "qualification_rate",
    tableMetricKey: "nomination",
    linkedMetricId: "qualification_rate",
    label: { ar: "الترشيح", en: "Qualification" },
    aggregation: "ratio",
    volatilitySensitivity: 0.4,
    cagrEligible: true,
    peakDetection: true,
    consistencyThresholds: { stable: 70, volatile: 42 },
    executiveInterpretation: {
      strongGrowth: { ar: "تحسّن تأهيل", en: "Qualification improving" },
      decline: { ar: "ضعف تأهيل", en: "Qualification weakening" },
      volatile: { ar: "تقلب مسار التأهيل", en: "Qualification path volatile" },
      stable: { ar: "مسار تأهيل مستقر", en: "Stable qualification path" },
    },
    exportWording: { ar: "معدل الترشيح", en: "Qualification rate" },
    heatmapMode: "representation",
    severity: { warnCagr: -6, criticalCagr: -15, warnVolatility: 50 },
  }),
  acceptance_rate: def({
    id: "acceptance_rate",
    tableMetricKey: "acceptance",
    linkedMetricId: "acceptance_rate",
    label: { ar: "القبول", en: "Acceptance" },
    aggregation: "ratio",
    volatilitySensitivity: 0.45,
    cagrEligible: true,
    peakDetection: true,
    consistencyThresholds: { stable: 68, volatile: 40 },
    executiveInterpretation: {
      strongGrowth: { ar: "تحويل قبول أقوى", en: "Stronger acceptance conversion" },
      decline: { ar: "تراجع قبول", en: "Acceptance decline" },
      volatile: { ar: "قبول متذبذب", en: "Volatile acceptance" },
      stable: { ar: "قبول مستقر", en: "Stable acceptance" },
    },
    exportWording: { ar: "معدل القبول", en: "Acceptance rate" },
    heatmapMode: "growth",
    severity: { warnCagr: -7, criticalCagr: -16, warnVolatility: 52 },
  }),
  talent_growth: def({
    id: "talent_growth",
    tableMetricKey: "gifted",
    linkedMetricId: "talent_growth",
    label: { ar: "نمو المواهب", en: "Talent growth" },
    aggregation: "sum",
    volatilitySensitivity: 0.55,
    cagrEligible: true,
    peakDetection: true,
    consistencyThresholds: { stable: 60, volatile: 38 },
    executiveInterpretation: {
      strongGrowth: { ar: "تسارع اكتشاف المواهب", en: "Accelerating talent discovery" },
      decline: { ar: "تباطؤ مسار المواهب", en: "Talent pipeline slowing" },
      volatile: { ar: "مواهب غير مستقرة", en: "Unstable talent signals" },
      stable: { ar: "مسار موهبة مستقر", en: "Stable talent pathway" },
    },
    exportWording: { ar: "نمو المواهب", en: "Talent growth" },
    heatmapMode: "growth",
    severity: { warnCagr: -5, criticalCagr: -12, warnVolatility: 58 },
  }),
  equity_gap: def({
    id: "equity_gap",
    linkedMetricId: "equity_gap",
    label: { ar: "فجوة الإنصاف", en: "Equity gap" },
    aggregation: "weighted_average",
    volatilitySensitivity: 0.3,
    cagrEligible: false,
    peakDetection: false,
    consistencyThresholds: { stable: 75, volatile: 50 },
    executiveInterpretation: {
      strongGrowth: { ar: "تحسّن تمثيل أوسع", en: "Broader representation improving" },
      decline: { ar: "تدهور إنصاف", en: "Equity deterioration" },
      volatile: { ar: "تمثيل متذبذب", en: "Volatile representation" },
      stable: { ar: "توازن تمثيلي", en: "Balanced representation" },
    },
    exportWording: { ar: "فجوة الإنصاف", en: "Equity gap" },
    heatmapMode: "representation",
    severity: { warnCagr: 0, criticalCagr: 0, warnVolatility: 48 },
  }),
  opportunity_score: def({
    id: "opportunity_score",
    linkedMetricId: "opportunity_score",
    label: { ar: "فرص النمو", en: "Opportunity score" },
    aggregation: "weighted_average",
    volatilitySensitivity: 0.42,
    cagrEligible: true,
    peakDetection: true,
    consistencyThresholds: { stable: 70, volatile: 44 },
    executiveInterpretation: {
      strongGrowth: { ar: "توسع فرص", en: "Opportunity expansion" },
      decline: { ar: "تركز فرص ضيق", en: "Narrow opportunity concentration" },
      volatile: { ar: "فرص متقلبة", en: "Volatile opportunities" },
      stable: { ar: "فرص مستدامة", en: "Sustainable opportunities" },
    },
    exportWording: { ar: "درجة الفرص", en: "Opportunity score" },
    heatmapMode: "growth",
    severity: { warnCagr: -6, criticalCagr: -14, warnVolatility: 54 },
  }),
  medal_conversion: def({
    id: "medal_conversion",
    tableMetricKey: "conversion",
    linkedMetricId: "medal_conversion",
    label: { ar: "تحويل ميدالي", en: "Medal conversion" },
    aggregation: "ratio",
    volatilitySensitivity: 0.48,
    cagrEligible: false,
    peakDetection: true,
    consistencyThresholds: { stable: 66, volatile: 40 },
    executiveInterpretation: {
      strongGrowth: { ar: "كفاءة ميدالية أعلى", en: "Higher medal efficiency" },
      decline: { ar: "تراجع تحويل ميدالي", en: "Medal conversion decline" },
      volatile: { ar: "تحويل متذبذب", en: "Volatile conversion" },
      stable: { ar: "تحويل مستقر", en: "Stable conversion" },
    },
    exportWording: { ar: "تحويل الميداليات", en: "Medal conversion" },
    heatmapMode: "medals",
    severity: { warnCagr: -8, criticalCagr: -20, warnVolatility: 55 },
  }),
  historical_growth: def({
    id: "historical_growth",
    linkedMetricId: "historical_growth",
    label: { ar: "النمو التاريخي", en: "Historical growth" },
    aggregation: "weighted_average",
    volatilitySensitivity: 0.38,
    cagrEligible: true,
    peakDetection: true,
    consistencyThresholds: { stable: 74, volatile: 46 },
    executiveInterpretation: {
      strongGrowth: { ar: "نمو تاريخي قوي", en: "Strong historical growth" },
      decline: { ar: "انكماش تاريخي", en: "Historical contraction" },
      volatile: { ar: "نمو غير مستقر", en: "Unstable growth" },
      stable: { ar: "نمو مستدام", en: "Sustainable growth" },
    },
    exportWording: { ar: "مؤشر النمو التاريخي", en: "Historical growth index" },
    heatmapMode: "growth",
    severity: { warnCagr: -10, criticalCagr: -22, warnVolatility: 56 },
  }),
};

export const getHistoricalMetricDef = (id: HistoricalMetricId): HistoricalMetricDefinition =>
  HISTORICAL_INTELLIGENCE_REGISTRY[id];

export const resolveHistoricalMetricFromTableKey = (
  tableMetricKey: string
): HistoricalMetricId | null => {
  for (const def of Object.values(HISTORICAL_INTELLIGENCE_REGISTRY)) {
    if (def.tableMetricKey === tableMetricKey) return def.id;
  }
  return null;
};

export const mapTrendSemanticToHistorical = (
  semantic: TrendSemantic
): keyof HistoricalMetricDefinition["executiveInterpretation"] => {
  if (semantic === "accelerating" || semantic === "emerging_growth") return "strongGrowth";
  if (semantic === "declining") return "decline";
  if (semantic === "volatile") return "volatile";
  return "stable";
};
