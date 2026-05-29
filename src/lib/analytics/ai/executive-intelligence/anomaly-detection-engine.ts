/**
 * anomaly-detection-engine.ts
 * Statistical anomaly detection using Z-score over YoY metrics.
 */

import type {
  ExecutiveInsight,
  InstitutionalSnapshot,
  YearOverYearMetrics,
} from "./executive-insight-types";

const Z_THRESHOLD = 1.8;

const stats = (values: number[]) => {
  if (values.length === 0) return { mean: 0, std: 1 };
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return { mean, std: Math.sqrt(variance) || 1 };
};

export const detectAnomalies = (
  snapshot: InstitutionalSnapshot
): ExecutiveInsight[] => {
  const insights: ExecutiveInsight[] = [];
  const now = new Date().toISOString();
  const yoy = [...snapshot.yearOverYear].sort((a, b) => a.year - b.year);
  if (yoy.length < 3) return insights;

  const participations = yoy.map((y) => y.totalParticipations);
  const { mean, std } = stats(participations);

  for (const y of yoy) {
    const z = (y.totalParticipations - mean) / std;
    if (Math.abs(z) < Z_THRESHOLD) continue;

    const isPositive = z > 0;
    insights.push({
      id: `anomaly-${y.year}-${Math.random().toString(36).slice(2,8)}`,
      insightType: isPositive ? "anomaly" : "anomaly",
      severity: Math.abs(z) >= 3 ? "critical" : "high",
      title: isPositive
        ? `ارتفاع غير معتاد في المشاركات سنة ${y.year}`
        : `انخفاض غير معتاد في المشاركات سنة ${y.year}`,
      titleEn: isPositive
        ? `Unusual participation spike in ${y.year}`
        : `Unusual participation drop in ${y.year}`,
      body: `سجّلت سنة ${y.year} قيمة ${y.totalParticipations} مشاركة (Z-score: ${Math.round(z * 10) / 10}) بعيدًا عن المتوسط ${Math.round(mean)}.`,
      evidence: [
        { label: "المشاركات", value: y.totalParticipations },
        { label: "المتوسط التاريخي", value: Math.round(mean) },
        { label: "Z-score", value: Math.round(z * 10) / 10 },
      ],
      recommendation: isPositive
        ? `تحليل عوامل النجاح في ${y.year} واستنساخها للسنوات القادمة.`
        : `تحليل أسباب الانخفاض في ${y.year} ووضع خطة وقائية.`,
      recommendationEn: isPositive
        ? `Analyze success factors from ${y.year} and replicate them.`
        : `Investigate the drop in ${y.year} and build a preventive plan.`,
      affectedEntity: String(y.year),
      affectedEntityType: "cohort",
      domain: "participation",
      confidence: Math.abs(z) >= 2.5 ? "HIGH" : "MEDIUM",
      generatedAt: now,
      metadata: { year: y.year, z: Math.round(z * 10) / 10 },
    });
  }

  return insights;
};
