/**
 * weak-stage-detector.ts
 * Detects stages with weak participation rates.
 */

import type {
  ExecutiveInsight,
  InstitutionalSnapshot,
  StageMetrics,
} from "./executive-insight-types";

const WEAK_THRESHOLD = 25;   // participation rate % below which we flag

const STAGE_LABELS: Record<string, string> = {
  primary: "المرحلة الابتدائية",
  middle: "المرحلة المتوسطة",
  secondary: "المرحلة الثانوية",
};

export const detectWeakStageInsights = (
  snapshot: InstitutionalSnapshot
): ExecutiveInsight[] => {
  const insights: ExecutiveInsight[] = [];
  const now = new Date().toISOString();

  for (const stage of snapshot.stageBreakdown) {
    if (stage.participationRatePct < WEAK_THRESHOLD) {
      const label = STAGE_LABELS[stage.stage] ?? stage.stage;
      const section = stage.section === "international" ? " (الدولي)" : stage.section === "arabic" ? " (العربي)" : "";
      insights.push({
        id: `weak-stage-${stage.stage}-${stage.section}-${Math.random().toString(36).slice(2,8)}`,
        insightType: "risk",
        severity: stage.participationRatePct < 10 ? "critical" : "high",
        title: `ضعف مشاركة ${label}${section}`,
        titleEn: `Low participation in ${stage.stage} stage${section}`,
        body: `نسبة المشاركة في ${label}${section} لا تتجاوز ${stage.participationRatePct}% من إجمالي الطلاب.`,
        evidence: [
          { label: "إجمالي الطلاب", value: stage.totalStudents },
          { label: "إجمالي المشاركات", value: stage.totalParticipations },
          { label: "نسبة المشاركة", value: stage.participationRatePct, unit: "%" },
          { label: "عدد الجوائز", value: stage.awardCount },
        ],
        recommendation: `تفعيل برامج اكتشاف المواهب المبكرة وحملات توعية مكثفة في ${label}${section} لرفع نسبة المشاركة.`,
        recommendationEn: `Launch early talent discovery programs and awareness campaigns for the ${stage.stage} stage.`,
        affectedEntity: `${stage.stage}-${stage.section}`,
        affectedEntityType: "stage",
        domain: "participation",
        confidence: stage.totalStudents >= 50 ? "HIGH" : "MEDIUM",
        generatedAt: now,
        metadata: {
          stage: stage.stage,
          section: stage.section,
          participationRatePct: stage.participationRatePct,
        },
      });
    }
  }

  return insights;
};
