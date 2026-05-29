/**
 * Historical Intelligence Narratives — confidence-aware executive insights.
 */

import type { HistoricalTrendIntelligence } from "@/lib/analytics/historical-trend-intelligence";
import type { HistoricalFunnelIntelligence } from "@/lib/analytics/shared/historical-funnel-types";
import type { HistoricalAlert } from "@/lib/analytics/historical-alert-engine";
import { ROW_CATEGORIES } from "@/lib/analytics/shared/historical-row-categories";
import { buildValidatedFunnelNarrativeFromValidator } from "@/lib/analytics/historical-funnel-validator";
import { formatExecutiveCagr, shortenExecutiveSentence } from "@/lib/analytics/ai/executive-intelligence/executive-wording-engine";
import { dedupeExecutiveNarratives } from "@/lib/analytics/ai/executive-intelligence/executive-insight-dedupe";
import { severityFromTrend } from "@/lib/analytics/ai/executive-intelligence/executive-severity-ranking";

export type HistoricalIntelligenceNarrative = {
  id: string;
  bodyAr: string;
  bodyEn: string;
  priority: number;
  activityKey?: string;
  metricId?: string;
  exploratory?: boolean;
};

const EXPLORATORY_AR = "النتائج استكشافية بسبب محدودية البيانات.";
const EXPLORATORY_EN = "Results are exploratory due to limited data coverage.";

export const buildHistoricalIntelligenceNarratives = (input: {
  activityTrends: HistoricalTrendIntelligence[];
  sectionTrends?: HistoricalTrendIntelligence[];
  funnel?: HistoricalFunnelIntelligence | null;
  alerts?: HistoricalAlert[];
  yearCount?: number;
  funnelConfidence?: number;
}): HistoricalIntelligenceNarrative[] => {
  const narratives: HistoricalIntelligenceNarrative[] = [];
  const yearCount = input.yearCount ?? 0;

  if (yearCount < 2) {
    return [
      {
        id: "insufficient_years",
        priority: 100,
        bodyAr: "يُعرض الجدول فقط — لا تُنشأ اتجاهات أو رؤى استراتيجية بأقل من سنتين.",
        bodyEn: "Tables only — trends and strategic insights require at least two years.",
      },
    ];
  }

  const lowConfidence =
    (input.funnelConfidence ?? 100) < 45 ||
    (input.funnel && !input.funnel.sufficient);

  if (lowConfidence) {
    narratives.push({
      id: "exploratory_mode",
      priority: 99,
      bodyAr: EXPLORATORY_AR,
      bodyEn: EXPLORATORY_EN,
      exploratory: true,
    });
  }

  const sorted = [...input.activityTrends].sort((a, b) => b.cagr - a.cagr);
  const leader = sorted[0];
  const laggard = sorted[sorted.length - 1];

  if (leader && leader.cagr >= 5 && leader.series.length >= 2 && !lowConfidence) {
    const cagrFmt = formatExecutiveCagr(leader.cagr, leader.series.length, { locale: "ar" });
    const cagrFmtEn = formatExecutiveCagr(leader.cagr, leader.series.length, { locale: "en" });
    const severity = severityFromTrend(leader.semantic, leader.cagr);
    const priority = severity === "critical" || severity === "high" ? 95 : 88;
    narratives.push({
      id: "sustained_growth_leader",
      priority,
      activityKey: leader.scope.key,
      metricId: leader.metricId,
      bodyAr: shortenExecutiveSentence(
        `${leader.scope.labelAr}: ${cagrFmt.display} — نمو ${leader.semantic === "volatile" ? "متقلب" : "مستدام"}.`
      ),
      bodyEn: shortenExecutiveSentence(
        `${leader.scope.labelEn}: ${cagrFmtEn.display} — ${leader.semantic} trajectory.`
      ),
    });
  }

  const volatile = input.activityTrends.find((t) => t.semantic === "volatile");
  if (
    volatile &&
    volatile.volatility >= 40 &&
    volatile.scope.key !== leader?.scope.key
  ) {
    narratives.push({
      id: "volatile_activity",
      priority: 85,
      activityKey: volatile.scope.key,
      bodyAr: shortenExecutiveSentence(
        `${volatile.scope.labelAr}: تقلب مشاركة ${volatile.volatility}% — راقب الاستقرار قبل التوسع.`
      ),
      bodyEn: shortenExecutiveSentence(
        `${volatile.scope.labelEn}: participation volatility ${volatile.volatility}% — stabilize before scaling.`
      ),
      exploratory: Boolean(lowConfidence),
    });
  }

  if (laggard && laggard.cagr <= -5 && laggard !== leader && laggard.series.length >= 2) {
    const declineFmt = formatExecutiveCagr(laggard.cagr, laggard.series.length, { locale: "ar" });
    const declineFmtEn = formatExecutiveCagr(laggard.cagr, laggard.series.length, { locale: "en" });
    narratives.push({
      id: "sustained_decline",
      priority: severityFromTrend("declining", laggard.cagr) === "critical" ? 92 : 88,
      activityKey: laggard.scope.key,
      bodyAr: shortenExecutiveSentence(`${laggard.scope.labelAr}: ${declineFmt.display}.`),
      bodyEn: shortenExecutiveSentence(`${laggard.scope.labelEn}: ${declineFmtEn.display}.`),
    });
  }

  const intl = ROW_CATEGORIES.filter((c) => c.section === "international");
  const ar = ROW_CATEGORIES.filter((c) => c.section === "arabic");
  const intlTrends = (input.sectionTrends ?? []).filter((t) =>
    intl.some((c) => c.key === t.scope.key)
  );
  const arTrends = (input.sectionTrends ?? []).filter((t) =>
    ar.some((c) => c.key === t.scope.key)
  );
  const intlAvg =
    intlTrends.length > 0
      ? intlTrends.reduce((s, t) => s + t.consistency.overall, 0) / intlTrends.length
      : 0;
  const arAvg =
    arTrends.length > 0
      ? arTrends.reduce((s, t) => s + t.consistency.overall, 0) / arTrends.length
      : 0;

  if (intlAvg > arAvg + 8 && intlTrends.length >= 2) {
    narratives.push({
      id: "intl_stability",
      priority: 82,
      bodyAr: "القسم الدولي يمتلك استقرارًا أعلى من العربي تاريخيًا.",
      bodyEn: "The international section shows higher historical stability than Arabic.",
    });
  } else if (arAvg > intlAvg + 8 && arTrends.length >= 2) {
    narratives.push({
      id: "ar_stability",
      priority: 82,
      bodyAr: "القسم العربي يمتلك استقرارًا أعلى من الدولي تاريخيًا.",
      bodyEn: "The Arabic section shows higher historical stability than international.",
    });
  }

  const talent = input.activityTrends.find((t) => t.scope.key.includes("mawhiba"));
  if (talent && talent.momentum > 5 && talent.series.length >= 3) {
    const since = talent.series[0]?.year ?? 0;
    narratives.push({
      id: "talent_acceleration",
      priority: 85,
      activityKey: talent.scope.key,
      bodyAr: `موهبة تُظهر تسارعًا إيجابيًا منذ ${since} (زخم ${talent.momentum}).`,
      bodyEn: `Gifted discovery shows positive acceleration since ${since} (momentum ${talent.momentum}).`,
    });
  }

  const sat = input.activityTrends.find((t) => t.scope.key === "sat");
  if (sat && sat.cagr <= -5 && sat.series.length >= 3) {
    narratives.push({
      id: "sat_decline",
      priority: 87,
      activityKey: "sat",
      bodyAr: `SAT يشهد انخفاضًا مستمرًا (${sat.cagr}%) على المدى التاريخي.`,
      bodyEn: `SAT shows a sustained decline (${sat.cagr}%) over the timeline.`,
    });
  }

  const funnelNarrative = buildValidatedFunnelNarrativeFromValidator(input.funnel);
  if (funnelNarrative) {
    narratives.push({
      id: "funnel_quality",
      priority: 80,
      bodyAr: funnelNarrative.bodyAr,
      bodyEn: funnelNarrative.bodyEn,
    });
  }

  for (const alert of (input.alerts ?? []).slice(0, 2)) {
    narratives.push({
      id: `alert-${alert.id}`,
      priority: alert.priority,
      activityKey: alert.activityKey,
      bodyAr: alert.bodyAr,
      bodyEn: alert.bodyEn,
    });
  }

  return dedupeExecutiveNarratives(
    narratives.sort((a, b) => b.priority - a.priority)
  );
};
