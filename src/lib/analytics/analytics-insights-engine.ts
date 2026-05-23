/**
 * Rule-based analytics insights from canonical snapshot only (no hallucination).
 */

import type { AnalyticsCanonicalSnapshot } from "@/lib/analytics/analytics-canonical-snapshot";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { FocusedActivityReportPayload } from "@/types/focused-activity-report";

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
};

export type AnalyticsInsightsBundle = {
  insights: AnalyticsInsight[];
  hasData: boolean;
};

const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

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
    if (femalePct > 0 && femalePct < 35) {
      insights.push({
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
    if (intlPct >= 15) {
      insights.push({
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

  return { insights: insights.slice(0, 12), hasData: true };
};
