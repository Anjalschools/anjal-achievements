/**
 * executive-opportunity-detector.ts
 * Finds untapped institutional opportunities.
 */

import type { ExecutiveInsight, InstitutionalSnapshot } from "./executive-insight-types";

const HIGH_GROWTH_ACTIVITY_THRESHOLD = 50;

export const detectOpportunities = (
  snapshot: InstitutionalSnapshot
): ExecutiveInsight[] => {
  const insights: ExecutiveInsight[] = [];
  const now = new Date().toISOString();

  // Rising activities
  for (const activity of snapshot.activityBreakdown) {
    if (activity.growthRatePct >= HIGH_GROWTH_ACTIVITY_THRESHOLD && activity.currentYear >= 5) {
      insights.push({
        id: `track-rise-${activity.activityKey}-${Math.random().toString(36).slice(2,8)}`,
        insightType: "track_rise",
        severity: "high",
        title: `ارتفاع قوي في مسار ${activity.activityLabelAr}`,
        titleEn: `Strong rise in ${activity.activityKey} track`,
        body: `سجّل نشاط ${activity.activityLabelAr} نمواً بنسبة ${activity.growthRatePct}% هذا العام (${activity.previousYear} → ${activity.currentYear} مشاركة).`,
        evidence: [
          { label: "مشاركات السنة الحالية", value: activity.currentYear },
          { label: "مشاركات السنة السابقة", value: activity.previousYear },
          { label: "النمو", value: activity.growthRatePct, unit: "%" },
          { label: "الجوائز", value: activity.awardCount },
        ],
        recommendation: `توسيع برامج ${activity.activityLabelAr} والاستثمار في الطاقة الاستيعابية لاستقبال المزيد من الطلاب.`,
        recommendationEn: `Scale ${activity.activityKey} programs to capture growing demand.`,
        affectedEntity: activity.activityKey,
        affectedEntityType: "activity",
        domain: activity.domain,
        confidence: activity.currentYear >= 20 ? "HIGH" : "MEDIUM",
        generatedAt: now,
        metadata: { activityKey: activity.activityKey, growthRatePct: activity.growthRatePct },
      });
    }

    // Falling tracks
    if (activity.growthRatePct <= -30 && activity.previousYear >= 10) {
      insights.push({
        id: `track-fall-${activity.activityKey}-${Math.random().toString(36).slice(2,8)}`,
        insightType: "track_fall",
        severity: "high",
        title: `تراجع في مسار ${activity.activityLabelAr}`,
        titleEn: `Declining ${activity.activityKey} track`,
        body: `تراجعت مشاركات ${activity.activityLabelAr} بنسبة ${Math.abs(activity.growthRatePct)}%.`,
        evidence: [
          { label: "مشاركات السنة الحالية", value: activity.currentYear },
          { label: "مشاركات السنة السابقة", value: activity.previousYear },
          { label: "التراجع", value: activity.growthRatePct, unit: "%" },
        ],
        recommendation: `مراجعة وإعادة تصميم برامج ${activity.activityLabelAr} لاستعادة الزخم.`,
        recommendationEn: `Review and redesign ${activity.activityKey} programs to regain momentum.`,
        affectedEntity: activity.activityKey,
        affectedEntityType: "activity",
        domain: activity.domain,
        confidence: "HIGH",
        generatedAt: now,
        metadata: { activityKey: activity.activityKey, growthRatePct: activity.growthRatePct },
      });
    }
  }

  return insights;
};
