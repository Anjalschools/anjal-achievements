/**
 * Rule-based analytics insights from canonical snapshot only (no hallucination).
 */

import type { AnalyticsCanonicalSnapshot } from "@/lib/analytics/analytics-canonical-snapshot";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { FocusedActivityReportPayload } from "@/types/focused-activity-report";
import {
  computeMedalConversionRate,
  computeInternationalAchievementRate,
} from "@/lib/analytics/analytics-metrics-definitions";

export type AnalyticsInsightSeverity = "info" | "warn" | "critical";

export type AnalyticsInsight = {
  id: string;
  severity: AnalyticsInsightSeverity;
  confidence: number;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  metricKeys: string[];
  metricSource?: string;
  evidenceAr?: string;
  evidenceEn?: string;
  affectedScope?: string;
};

export type AnalyticsInsightsBundle = {
  insights: AnalyticsInsight[];
  hasData: boolean;
};

const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

const pushInsight = (
  insights: AnalyticsInsight[],
  row: AnalyticsInsight
): void => {
  insights.push(row);
};

export const buildAnalyticsInsights = (input: {
  snapshot: AnalyticsCanonicalSnapshot;
  general: ParticipationAnalyticsPayload | null;
  focused: FocusedActivityReportPayload | null;
}): AnalyticsInsightsBundle => {
  const insights: AnalyticsInsight[] = [];
  const total = input.snapshot.totalParticipations;
  if (total <= 0) {
    return { insights: [], hasData: false };
  }

  const g = input.general;
  const f = input.focused;

  if (g?.kpis) {
    const femalePct = g.kpis.femalePct ?? 0;
    const intlPct = g.kpis.internationalSectionPct ?? 0;
    const medalRate = computeMedalConversionRate(g);
    const intlAchRate = computeInternationalAchievementRate(g);

    if (g.charts.yearTrend.length >= 2) {
      const sorted = [...g.charts.yearTrend].sort((a, b) => a.year - b.year);
      const last = sorted[sorted.length - 1]!;
      const prev = sorted[sorted.length - 2]!;
      if (prev.totalRows > 0) {
        const yoy = ((last.totalRows - prev.totalRows) / prev.totalRows) * 100;
        if (yoy >= 40) {
          pushInsight(insights, {
            id: "yearly_participation_spike",
            severity: "info",
            confidence: 0.82,
            titleAr: "قفزة سنوية في المشاركة",
            titleEn: "Yearly participation spike",
            bodyAr: `قفزة ${Math.round(yoy)}% بين ${prev.year} و${last.year}.`,
            bodyEn: `Spike of ${Math.round(yoy)}% between ${prev.year} and ${last.year}.`,
            metricKeys: ["yearTrend"],
            metricSource: "participationAnalytics.yearTrend",
            evidenceAr: `${prev.year}: ${prev.totalRows} → ${last.year}: ${last.totalRows}`,
            evidenceEn: `${prev.year}: ${prev.totalRows} → ${last.year}: ${last.totalRows}`,
            affectedScope: "school-wide",
          });
        }
        if (yoy <= -25) {
          pushInsight(insights, {
            id: "participation_drop_alert",
            severity: "warn",
            confidence: 0.8,
            titleAr: "تنبيه انخفاض المشاركة",
            titleEn: "Participation drop alert",
            bodyAr: `انخفاض ${Math.round(Math.abs(yoy))}% بين ${prev.year} و${last.year}.`,
            bodyEn: `Drop of ${Math.round(Math.abs(yoy))}% between ${prev.year} and ${last.year}.`,
            metricKeys: ["yearTrend"],
            metricSource: "participationAnalytics.yearTrend",
            evidenceAr: `${last.totalRows} سجل مقابل ${prev.totalRows}`,
            evidenceEn: `${last.totalRows} records vs ${prev.totalRows}`,
            affectedScope: "school-wide",
          });
        }
      }
    }

    const gold = g.charts.resultOutcomeCompare.find((x) => x.key === "gold")?.count ?? 0;
    const silver = g.charts.resultOutcomeCompare.find((x) => x.key === "silver")?.count ?? 0;
    if (gold > 0 && silver > 0 && gold < silver * 0.5) {
      pushInsight(insights, {
        id: "medal_trend_gold_below_silver",
        severity: "warn",
        confidence: 0.68,
        titleAr: "تراجع نسبي للذهبية",
        titleEn: "Gold medal share lagging",
        bodyAr: `ذهبية ${gold} مقابل فضية ${silver} ضمن النطاق المفلتر.`,
        bodyEn: `Gold ${gold} vs silver ${silver} under current filters.`,
        metricKeys: ["medalConversionRate", "resultOutcomeCompare"],
        metricSource: "analytics-metrics-definitions.medalConversionRate",
        evidenceAr: `معدل تحويل ميداليات: ${medalRate}%`,
        evidenceEn: `Medal conversion rate: ${medalRate}%`,
        affectedScope: "filtered-cohort",
      });
    }

    const arabic = g.charts.sectionParticipation.find((x) => x.key === "arabic")?.count ?? 0;
    const international = g.charts.sectionParticipation.find((x) => x.key === "international")?.count ?? 0;
    const sectionTotal = arabic + international;
    if (sectionTotal >= 30) {
      const intlShare = pct(international, sectionTotal);
      const arShare = pct(arabic, sectionTotal);
      if (intlShare >= 72 || arShare >= 72) {
        pushInsight(insights, {
          id: "division_imbalance",
          severity: "warn",
          confidence: 0.74,
          titleAr: "اختلال توازن الأقسام",
          titleEn: "Division imbalance",
          bodyAr: `عربي ${arShare}% · دولي ${intlShare}% من المشاركات.`,
          bodyEn: `Arabic ${arShare}% · International ${intlShare}% of participations.`,
          metricKeys: ["sectionParticipation"],
          metricSource: "participationAnalytics.sectionParticipation",
          evidenceAr: `${arabic} عربي / ${international} دولي`,
          evidenceEn: `${arabic} Arabic / ${international} international`,
          affectedScope: "sections",
        });
      }
    }

    if (intlAchRate >= 20) {
      pushInsight(insights, {
        id: "international_participation_alert",
        severity: "info",
        confidence: 0.77,
        titleAr: "تنبيه مشاركة دولية",
        titleEn: "International participation alert",
        bodyAr: `نسبة إنجازات دولية ${intlAchRate}%.`,
        bodyEn: `International achievement rate is ${intlAchRate}%.`,
        metricKeys: ["internationalAchievementRate"],
        metricSource: "analytics-metrics-definitions.internationalAchievementRate",
        evidenceAr: `${intlPct}% من المشاركات — قسم دولي`,
        evidenceEn: `${intlPct}% participations — international section`,
        affectedScope: "international-section",
      });
    }

    const inactive = g.table.filter((r) => r.totalParticipations === 0);
    if (inactive.length >= 3 && g.table.length >= 8) {
      pushInsight(insights, {
        id: "inactive_activities_detection",
        severity: "info",
        confidence: 0.7,
        titleAr: "أنشطة بلا مشاركات",
        titleEn: "Inactive activities detected",
        bodyAr: `${inactive.length} نشاط/أنشطة بدون سجلات ضمن الفلاتر.`,
        bodyEn: `${inactive.length} activity row(s) with zero records under filters.`,
        metricKeys: ["activityTable"],
        metricSource: "participationAnalytics.table",
        affectedScope: "activities",
      });
    }

    const growthActs = [...g.table]
      .filter((r) => r.totalParticipations >= 5)
      .sort((a, b) => b.totalParticipations - a.totalParticipations)
      .slice(0, 3);
    if (growthActs.length > 0 && growthActs[0]!.totalParticipations >= 15) {
      pushInsight(insights, {
        id: "growth_activities_detection",
        severity: "info",
        confidence: 0.76,
        titleAr: "أنشطة نمو عالية",
        titleEn: "High-growth activities",
        bodyAr: `أعلى نشاط: ${growthActs[0]!.activityLabelAr} (${growthActs[0]!.totalParticipations} سجل).`,
        bodyEn: `Top activity: ${growthActs[0]!.activityLabelEn} (${growthActs[0]!.totalParticipations} records).`,
        metricKeys: ["topActivityScore"],
        metricSource: "participationAnalytics.table",
        affectedScope: growthActs[0]!.activityKey,
      });
    }

    if (femalePct > 0 && femalePct < 35) {
      pushInsight(insights, {
        id: "gender_gap_low_female_share",
        severity: "warn",
        confidence: 0.72,
        titleAr: "فجوة مشاركة إناث",
        titleEn: "Female participation gap",
        bodyAr: `نسبة مشاركة البنات ${femalePct}% من الإجمالي — راجع برامج التحفيز المستهدفة.`,
        bodyEn: `Female share is ${femalePct}% of participations — consider targeted engagement.`,
        metricKeys: ["genderParticipation"],
      });
    }
    if (medalRate >= 35 && g.kpis.totalParticipations >= 25) {
      pushInsight(insights, {
        id: "medal_density_anomaly_high",
        severity: "info",
        confidence: 0.71,
        titleAr: "كثافة ميداليات مرتفعة",
        titleEn: "High medal density anomaly",
        bodyAr: `معدل تحويل ${medalRate}% أعلى من المتوسط المعتاد.`,
        bodyEn: `Conversion rate ${medalRate}% is above typical baseline.`,
        metricKeys: ["medalConversionRate"],
        metricSource: "analytics-metrics-definitions.medalConversionRate",
        evidenceAr: `${g.kpis.goldMedalCount} ذهبية من ${g.kpis.totalParticipations}`,
        evidenceEn: `${g.kpis.goldMedalCount} gold of ${g.kpis.totalParticipations}`,
        affectedScope: "filtered-cohort",
      });
    }

    if (intlPct >= 15) {
      pushInsight(insights, {
        id: "international_share_elevated",
        severity: "info",
        confidence: 0.8,
        titleAr: "حضور دولي ملحوظ",
        titleEn: "Notable international share",
        bodyAr: `${intlPct}% من المشاركات من القسم الدولي.`,
        bodyEn: `${intlPct}% of participations are from the international section.`,
        metricKeys: ["sectionParticipation"],
      });
    }
    const outcomeSum = g.charts.resultOutcomeCompare.reduce((s, x) => s + x.count, 0);
    if (outcomeSum < g.kpis.totalParticipations * 0.85) {
      insights.push({
        id: "outcome_bucket_gap",
        severity: "info",
        confidence: 0.65,
        titleAr: "نتائج غير مصنّفة في الرسم",
        titleEn: "Unbucketed outcomes in chart",
        bodyAr: "جزء من السجلات يستخدم أنواع نتائج خارج الدائرة القياسية (مثل إتمام/درجة).",
        bodyEn: "Some records use outcome types outside the standard donut buckets.",
        metricKeys: ["resultOutcomeCompare"],
      });
    }
  }

  if (f?.executive?.yearComparison && f.executive.yearComparison.length >= 2) {
    const ys = f.executive.yearComparison;
    const last = ys[ys.length - 1]!;
    const prev = ys[ys.length - 2]!;
    if (prev.records > 0) {
      const growth = ((last.records - prev.records) / prev.records) * 100;
      if (growth >= 20) {
        insights.push({
          id: "participation_growth",
          severity: "info",
          confidence: 0.78,
          titleAr: "نمو المشاركة",
          titleEn: "Participation growth",
          bodyAr: `ارتفاع السجلات ${Math.round(growth)}% بين ${prev.year} و${last.year}.`,
          bodyEn: `Records up ${Math.round(growth)}% from ${prev.year} to ${last.year}.`,
          metricKeys: ["yearTrend"],
        });
      } else if (growth <= -15) {
        insights.push({
          id: "participation_decline",
          severity: "warn",
          confidence: 0.75,
          titleAr: "تراجع المشاركة",
          titleEn: "Participation decline",
          bodyAr: `انخفاض السجلات ${Math.round(Math.abs(growth))}% بين ${prev.year} و${last.year}.`,
          bodyEn: `Records down ${Math.round(Math.abs(growth))}% from ${prev.year} to ${last.year}.`,
          metricKeys: ["yearTrend"],
        });
      }
    }
  }

  for (const [cat, count] of input.snapshot.dataset.byCategory) {
    if (
      (cat === "training_courses" || cat === "early_university_admission" || cat === "entrepreneurship") &&
      count >= 3
    ) {
      insights.push({
        id: `special_category_${cat}`,
        severity: "info",
        confidence: 0.85,
        titleAr: "تصنيف خاص نشط",
        titleEn: "Active special category",
        bodyAr: `${count} سجل/سجلات ضمن تصنيف «${cat}».`,
        bodyEn: `${count} record(s) in category «${cat}».`,
        metricKeys: ["analyticsCategory", cat],
      });
    }
  }

  if (f && f.kpis.totalRecords > 0) {
    const medalRate = pct(
      (f.charts.resultBars.find((x) => x.key === "gold")?.count ?? 0) +
        (f.charts.resultBars.find((x) => x.key === "silver")?.count ?? 0) +
        (f.charts.resultBars.find((x) => x.key === "bronze")?.count ?? 0),
      f.kpis.totalRecords
    );
    if (medalRate < 8 && f.kpis.totalRecords >= 20) {
      insights.push({
        id: "weak_medal_density",
        severity: "warn",
        confidence: 0.7,
        titleAr: "كثافة ميداليات منخفضة",
        titleEn: "Low medal density",
        bodyAr: `معدل الميداليات ${medalRate}% ضمن النشاط المحدد.`,
        bodyEn: `Medal rate is ${medalRate}% for the selected activity.`,
        metricKeys: ["resultBars"],
      });
    }
  }

  return { insights: insights.slice(0, 16), hasData: true };
};
