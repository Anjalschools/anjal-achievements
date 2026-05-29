/**
 * Historical Alert Engine — executive signals from timeline intelligence.
 */

import type { HistoricalTrendIntelligence } from "@/lib/analytics/historical-trend-intelligence";
import type { HistoricalFunnelIntelligence } from "@/lib/analytics/shared/historical-funnel-types";
import { getHistoricalMetricDef } from "@/lib/analytics/historical-intelligence-registry";

export type HistoricalAlertSeverity = "info" | "warning" | "critical";

export type HistoricalAlertCode =
  | "sustained_decline"
  | "unstable_participation"
  | "medal_collapse"
  | "equity_deterioration"
  | "opportunity_concentration"
  | "participation_stagnation"
  | "funnel_leakage"
  | "recovery_signal";

export type HistoricalAlert = {
  id: string;
  code: HistoricalAlertCode;
  severity: HistoricalAlertSeverity;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  activityKey?: string;
  year?: number;
  priority: number;
};

export const buildHistoricalAlerts = (input: {
  trends: HistoricalTrendIntelligence[];
  funnel?: HistoricalFunnelIntelligence | null;
}): HistoricalAlert[] => {
  const alerts: HistoricalAlert[] = [];

  for (const trend of input.trends) {
    const def = getHistoricalMetricDef(trend.metricId);
    const scopeLabel = trend.scope.labelAr;

    if (trend.semantic === "declining" && trend.cagr <= def.severity.criticalCagr) {
      alerts.push({
        id: `decline-${trend.scope.key}-${trend.metricId}`,
        code: "sustained_decline",
        severity: "critical",
        titleAr: "تراجع مستمر",
        titleEn: "Sustained decline",
        bodyAr: `${scopeLabel}: تراجع ${trend.cagr}% — يحتاج تدخلًا إداريًا.`,
        bodyEn: `${trend.scope.labelEn}: ${trend.cagr}% decline — needs intervention.`,
        activityKey: trend.scope.kind === "activity" ? trend.scope.key : undefined,
        priority: 95,
      });
    } else if (trend.semantic === "declining") {
      alerts.push({
        id: `decline-warn-${trend.scope.key}`,
        code: "sustained_decline",
        severity: "warning",
        titleAr: "إشارة تراجع",
        titleEn: "Decline signal",
        bodyAr: `${scopeLabel} يتراجع بمعدل ${trend.cagr}%.`,
        bodyEn: `${trend.scope.labelEn} declining at ${trend.cagr}%.`,
        activityKey: trend.scope.kind === "activity" ? trend.scope.key : undefined,
        priority: 80,
      });
    }

    if (trend.semantic === "volatile" && trend.volatility >= def.severity.warnVolatility) {
      alerts.push({
        id: `volatile-${trend.scope.key}`,
        code: "unstable_participation",
        severity: "warning",
        titleAr: "تقلب مرتفع",
        titleEn: "High volatility",
        bodyAr: `${scopeLabel} — تقلب ${trend.volatility}%.`,
        bodyEn: `${trend.scope.labelEn} — volatility ${trend.volatility}%.`,
        activityKey: trend.scope.kind === "activity" ? trend.scope.key : undefined,
        priority: 75,
      });
    }

    if (
      trend.metricId === "medal_count" &&
      trend.cagr <= def.severity.criticalCagr
    ) {
      alerts.push({
        id: `medal-collapse-${trend.scope.key}`,
        code: "medal_collapse",
        severity: "critical",
        titleAr: "انهيار ميدالي",
        titleEn: "Medal collapse",
        bodyAr: `${scopeLabel}: انخفاض حاد في الميداليات.`,
        bodyEn: `${trend.scope.labelEn}: sharp medal drop.`,
        activityKey: trend.scope.key,
        priority: 92,
      });
    }

    if (trend.metricId === "equity_gap" && trend.cagr > 8) {
      alerts.push({
        id: "equity-deterioration",
        code: "equity_deterioration",
        severity: "warning",
        titleAr: "تدهور إنصاف",
        titleEn: "Equity deterioration",
        bodyAr: "اتساع فجوة التمثيل بين الأقسام.",
        bodyEn: "Representation gap widening across sections.",
        priority: 78,
      });
    }

    if (trend.metricId === "opportunity_score" && trend.consistency.overall < 45) {
      alerts.push({
        id: `opportunity-${trend.scope.key}`,
        code: "opportunity_concentration",
        severity: "info",
        titleAr: "تركز فرص",
        titleEn: "Opportunity concentration",
        bodyAr: `${scopeLabel} يعتمد على سنة استثنائية.`,
        bodyEn: `${trend.scope.labelEn} relies on a single peak year.`,
        priority: 65,
      });
    }

    if (
      trend.metricId === "participation_count" &&
      Math.abs(trend.cagr) < 3 &&
      trend.volatility < 15
    ) {
      alerts.push({
        id: `stagnation-${trend.scope.key}`,
        code: "participation_stagnation",
        severity: "info",
        titleAr: "جمود مشاركة",
        titleEn: "Participation stagnation",
        bodyAr: `${scopeLabel}: نمو محدود (${trend.cagr}%).`,
        bodyEn: `${trend.scope.labelEn}: limited growth (${trend.cagr}%).`,
        activityKey: trend.scope.kind === "activity" ? trend.scope.key : undefined,
        priority: 55,
      });
    }

    if (trend.semantic === "recovery") {
      alerts.push({
        id: `recovery-${trend.scope.key}`,
        code: "recovery_signal",
        severity: "info",
        titleAr: "تعافٍ تاريخي",
        titleEn: "Historical recovery",
        bodyAr: `${scopeLabel} يتعافى بعد ${trend.peaks.worstYear}.`,
        bodyEn: `${trend.scope.labelEn} recovering after ${trend.peaks.worstYear}.`,
        year: trend.peaks.inflectionYear,
        priority: 70,
      });
    }
  }

  if (input.funnel?.sufficient && input.funnel.funnelLeakage >= 40) {
    alerts.push({
      id: "funnel-leakage",
      code: "funnel_leakage",
      severity: input.funnel.funnelLeakage >= 55 ? "critical" : "warning",
      titleAr: "تسرب مسار المواهب",
      titleEn: "Talent pipeline leakage",
      bodyAr: input.funnel.narrativeAr,
      bodyEn: input.funnel.narrativeEn,
      priority: 88,
    });
  }

  return alerts.sort((a, b) => b.priority - a.priority);
};
