/**
 * Strategic narratives — unifies metric registry, cube, trends, and funnels.
 */

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import { buildIntelligenceCube } from "@/lib/analytics/educational-intelligence-cube";
import { buildHistoricalTrendAnalysis, buildMultiMetricTrendBundle } from "@/lib/analytics/historical-trend-engine";
import {
  buildAllEducationalFunnels,
  buildFunnelNarratives,
} from "@/lib/analytics/educational-funnel-intelligence";
import {
  computeMetricFromPayload,
  evaluateMetricSeverity,
  formatMetricValue,
  getMetricDefinition,
  type MetricId,
} from "@/lib/analytics/analytics-metric-registry";

export type StrategicNarrative = {
  id: string;
  category: "trend" | "funnel" | "governance" | "equity" | "forecast";
  priority: number;
  severity: "info" | "warn" | "critical";
  bodyAr: string;
  bodyEn: string;
  metricIds: MetricId[];
};

const cubeTotals = (data: ParticipationAnalyticsPayload) => {
  const medals =
    data.kpis.goldMedalCount +
    data.table.reduce((s, r) => s + r.silverMedalCount + r.bronzeMedalCount, 0);
  const topAct = [...data.table].sort((a, b) => b.totalParticipations - a.totalParticipations)[0];
  const topShare =
    data.kpis.totalParticipations > 0 && topAct
      ? Math.round((topAct.totalParticipations / data.kpis.totalParticipations) * 1000) / 10
      : 0;
  return {
    participations: data.kpis.totalParticipations,
    students: data.kpis.distinctStudents,
    medals,
    nominations: data.kpis.nominationCount,
    acceptances: data.table.reduce((s, r) => s + r.approvedAchievements, 0),
    topActivityShare: topShare,
  };
};

export const buildStrategicNarratives = (input: {
  general: ParticipationAnalyticsPayload | null;
  historicalSlices?: HistoricalYearSlice[];
  locale?: "ar" | "en";
}): StrategicNarrative[] => {
  const { general, historicalSlices = [] } = input;
  if (!general || general.kpis.totalParticipations <= 0) return [];

  const narratives: StrategicNarrative[] = [];
  const totals = cubeTotals(general);
  const cube = buildIntelligenceCube(general);

  const governanceMetrics: MetricId[] = [
    "institutional_growth",
    "participation_sustainability",
    "talent_pipeline_health",
    "program_effectiveness",
  ];

  for (const metricId of governanceMetrics) {
    const value = computeMetricFromPayload(metricId, totals);
    const severity = evaluateMetricSeverity(metricId, value);
    if (severity === "ok") continue;
    const def = getMetricDefinition(metricId);
    narratives.push({
      id: `gov_${metricId}`,
      category: "governance",
      priority: severity === "critical" ? 92 : 78,
      severity: severity === "critical" ? "critical" : "warn",
      bodyAr: `${def.label.ar}: ${formatMetricValue(metricId, value, "ar")} — ${def.narrativeWording.down.ar}.`,
      bodyEn: `${def.label.en}: ${formatMetricValue(metricId, value, "en")} — ${def.narrativeWording.down.en}.`,
      metricIds: [metricId],
    });
  }

  const arabicP = general.charts.sectionParticipation.find((s) => s.key === "arabic")?.count ?? 0;
  const intlP = general.charts.sectionParticipation.find((s) => s.key === "international")?.count ?? 0;
  if (arabicP > intlP * 1.2) {
    narratives.push({
      id: "arabic_program_growth",
      category: "equity",
      priority: 72,
      severity: "info",
      bodyAr: "القسم العربي يقود نمو البرامج العلمية في النطاق الحالي.",
      bodyEn: "The Arabic section leads scientific program growth in the current scope.",
      metricIds: ["historical_growth"],
    });
  }

  for (const trend of buildMultiMetricTrendBundle(historicalSlices).slice(0, 2)) {
    for (const tn of trend.narratives.slice(0, 1)) {
      narratives.push({
        id: tn.id,
        category: "trend",
        priority: tn.priority,
        severity: "info",
        bodyAr: tn.bodyAr,
        bodyEn: tn.bodyEn,
        metricIds: [trend.metricId],
      });
    }
  }

  if (historicalSlices.length >= 2) {
    const histTrend = buildHistoricalTrendAnalysis(historicalSlices, "medal_conversion");
    if (histTrend.semantic === "declining") {
      narratives.push({
        id: "medal_conversion_decline",
        category: "trend",
        priority: 87,
        severity: "warn",
        bodyAr: `تراجع تحويل الميداليات (CAGR ${histTrend.indicators.cagr}%).`,
        bodyEn: `Medal conversion declined (CAGR ${histTrend.indicators.cagr}%).`,
        metricIds: ["medal_conversion"],
      });
    }
  }

  const funnels = buildAllEducationalFunnels(general);
  for (const fn of buildFunnelNarratives(funnels)) {
    narratives.push({
      id: fn.id,
      category: "funnel",
      priority: fn.priority,
      severity: fn.priority >= 85 ? "warn" : "info",
      bodyAr: fn.bodyAr,
      bodyEn: fn.bodyEn,
      metricIds: ["funnel_success_rate", "program_conversion"],
    });
  }

  const concentration = computeMetricFromPayload("activity_concentration", totals);
  if (concentration >= 40) {
    narratives.push({
      id: "activity_concentration_risk",
      category: "governance",
      priority: 70,
      severity: "warn",
      bodyAr: `تركز مرتفع في نشاط واحد (${formatMetricValue("activity_concentration", concentration, "ar")}).`,
      bodyEn: `High activity concentration (${formatMetricValue("activity_concentration", concentration, "en")}).`,
      metricIds: ["activity_concentration"],
    });
  }

  void cube;

  return narratives.sort((a, b) => b.priority - a.priority).slice(0, 10);
};
