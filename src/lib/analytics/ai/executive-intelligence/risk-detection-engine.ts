/**
 * risk-detection-engine.ts
 * Detects students at risk of decline and program gaps.
 */

import type { ExecutiveInsight, InstitutionalSnapshot } from "./executive-insight-types";

export const detectRisks = (
  snapshot: InstitutionalSnapshot
): ExecutiveInsight[] => {
  const insights: ExecutiveInsight[] = [];
  const now = new Date().toISOString();
  const samples = snapshot.studentSamples ?? [];

  // At-risk students
  const atRisk = samples.filter(
    (s) => s.recentTrend === "declining" || (s.momentum === "low" && s.recentQuality < 30)
  );

  for (const s of atRisk) {
    insights.push({
      id: `risk-student-${s.userId}-${Math.random().toString(36).slice(2,8)}`,
      insightType: "risk",
      severity: s.recentTrend === "declining" ? "high" : "medium",
      title: `طالب معرض للتراجع — ${s.displayName}`,
      titleEn: `Student at risk of decline — ${s.displayName}`,
      body: `يُسجّل الطالب اتجاهاً تراجعياً بجودة حديثة ${Math.round(s.recentQuality)}/100 مقارنةً بأعلى مستوى ${s.peakQuality}/100.`,
      evidence: [
        { label: "الاتجاه", value: s.recentTrend },
        { label: "الجودة الأخيرة", value: Math.round(s.recentQuality) },
        { label: "أعلى جودة تاريخية", value: s.peakQuality },
      ],
      recommendation: `متابعة الطالب وتقديم دعم تحفيزي وأكاديمي لمنع الانقطاع.`,
      recommendationEn: `Follow up with student and provide motivational and academic support.`,
      affectedEntity: s.userId,
      affectedEntityType: "student",
      domain: "participation",
      confidence: "MEDIUM",
      generatedAt: now,
      metadata: { userId: s.userId, trend: s.recentTrend },
    });
  }

  // Program gap: activity with zero participation
  for (const activity of snapshot.activityBreakdown) {
    if (activity.currentYear === 0 && activity.previousYear > 0) {
      insights.push({
        id: `program-gap-${activity.activityKey}-${Math.random().toString(36).slice(2,8)}`,
        insightType: "program_gap",
        severity: activity.previousYear >= 20 ? "high" : "medium",
        title: `انقطاع في ${activity.activityLabelAr}`,
        titleEn: `Zero participation in ${activity.activityKey}`,
        body: `لا توجد مشاركات في ${activity.activityLabelAr} هذا العام رغم ${activity.previousYear} مشاركة العام الماضي.`,
        evidence: [
          { label: "مشاركات السنة الحالية", value: 0 },
          { label: "مشاركات السنة السابقة", value: activity.previousYear },
        ],
        recommendation: `مراجعة أسباب الانقطاع في ${activity.activityLabelAr} وإعادة تفعيل المشاركة.`,
        recommendationEn: `Investigate why participation in ${activity.activityKey} dropped to zero and re-engage students.`,
        affectedEntity: activity.activityKey,
        affectedEntityType: "activity",
        domain: activity.domain,
        confidence: "HIGH",
        generatedAt: now,
        metadata: { activityKey: activity.activityKey },
      });
    }
  }

  return insights;
};
