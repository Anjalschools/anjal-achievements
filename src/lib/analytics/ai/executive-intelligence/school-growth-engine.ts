/**
 * school-growth-engine.ts
 * Detects fastest-growing and declining schools.
 */

import type {
  ExecutiveInsight,
  InstitutionalSnapshot,
} from "./executive-insight-types";

const GROWTH_THRESHOLD  = 30;  // % growth → "growth" insight
const DECLINE_THRESHOLD = -20; // % decline → "decline" insight

export const detectSchoolGrowthInsights = (
  snapshot: InstitutionalSnapshot
): ExecutiveInsight[] => {
  const insights: ExecutiveInsight[] = [];
  const now = new Date().toISOString();

  for (const school of snapshot.schoolBreakdown) {
    if (school.growthRatePct >= GROWTH_THRESHOLD) {
      insights.push({
        id: `school-growth-${school.schoolId}-${Math.random().toString(36).slice(2,8)}`,
        insightType: "growth",
        severity: school.growthRatePct >= 60 ? "critical" : "high",
        title: `نمو قوي في مدرسة ${school.schoolName}`,
        titleEn: `Strong growth at ${school.schoolName}`,
        body: `سجّلت المدرسة نمواً بنسبة ${school.growthRatePct}% في المشاركات مقارنةً بالعام السابق (${school.previousYear} → ${school.currentYear} مشاركة).`,
        evidence: [
          { label: "مشاركات السنة الحالية", value: school.currentYear },
          { label: "مشاركات السنة السابقة", value: school.previousYear },
          { label: "نسبة النمو", value: school.growthRatePct, unit: "%" },
          { label: "عدد الجوائز", value: school.awardCount },
        ],
        recommendation: `دراسة أسباب النمو لاستنساخها في مدارس أخرى، وتعزيز دعم برامج المدرسة.`,
        recommendationEn: `Investigate growth drivers and replicate them across underperforming schools.`,
        affectedEntity: school.schoolName,
        affectedEntityType: "school",
        domain: "participation",
        confidence: school.currentYear >= 10 ? "HIGH" : "MEDIUM",
        generatedAt: now,
        metadata: { schoolId: school.schoolId, growthRatePct: school.growthRatePct },
      });
    }

    if (school.growthRatePct <= DECLINE_THRESHOLD) {
      insights.push({
        id: `school-decline-${school.schoolId}-${Math.random().toString(36).slice(2,8)}`,
        insightType: "decline",
        severity: school.growthRatePct <= -40 ? "critical" : "high",
        title: `تراجع في مدرسة ${school.schoolName}`,
        titleEn: `Declining participation at ${school.schoolName}`,
        body: `سجّلت المدرسة تراجعاً بنسبة ${Math.abs(school.growthRatePct)}% في المشاركات.`,
        evidence: [
          { label: "مشاركات السنة الحالية", value: school.currentYear },
          { label: "مشاركات السنة السابقة", value: school.previousYear },
          { label: "نسبة التراجع", value: school.growthRatePct, unit: "%" },
        ],
        recommendation: `إجراء تدخل فوري: تواصل مع إدارة المدرسة لتشخيص أسباب التراجع ووضع خطة تعافٍ.`,
        recommendationEn: `Immediate intervention: contact school leadership to diagnose and address the decline.`,
        affectedEntity: school.schoolName,
        affectedEntityType: "school",
        domain: "participation",
        confidence: "HIGH",
        generatedAt: now,
        metadata: { schoolId: school.schoolId, growthRatePct: school.growthRatePct },
      });
    }
  }

  return insights;
};
