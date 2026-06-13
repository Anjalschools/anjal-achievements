import type { PredictiveScenario } from "@/lib/school-improvement/school-improvement-types";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";
import type { StudentSuccessGraphNode } from "@/lib/school-intelligence/school-intelligence-types";

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

export const buildPredictiveScenarios = (
  intelligence: SchoolIntelligencePayload,
  nodes: StudentSuccessGraphNode[]
): PredictiveScenario[] => {
  const avgTraining = nodes.length
    ? nodes.reduce((s, n) => s + n.trainingHours, 0) / nodes.length
    : 0;
  const avgSuccess = intelligence.studentSuccessGraph.avgSuccessIndex;
  const participation = intelligence.schoolExcellence.activeParticipants;

  const trainingBoost = clamp(avgSuccess + avgTraining * 0.08 * 0.2 + 3);
  const bebrasBoost = clamp(avgSuccess + participation * 0.002 + 2);
  const volunteerBoost = clamp(
    avgSuccess +
      (nodes.reduce((s, n) => s + n.volunteerHours, 0) / Math.max(nodes.length, 1)) * 0.05 * 0.2
  );

  return [
    {
      id: "sim-training-plus-20",
      scenarioAr: "زيادة التدريب 20%",
      scenarioEn: "Increase training by 20%",
      changePct: 20,
      metric: "avgStudentSuccessIndex",
      currentValue: avgSuccess,
      projectedValue: trainingBoost,
      projectedImpactAr: `رفع متوقع لمؤشر النجاح من ${avgSuccess} إلى ${trainingBoost}`,
      projectedImpactEn: `Projected success index rise from ${avgSuccess} to ${trainingBoost}`,
      confidence: "LOW",
      method: "training_hours_elasticity_0.08",
    },
    {
      id: "sim-bebras-expansion",
      scenarioAr: "زيادة مشاركة بيبراس",
      scenarioEn: "Increase Bebras participation",
      changePct: 15,
      metric: "schoolParticipation",
      currentValue: participation,
      projectedValue: Math.round(participation * 1.15),
      projectedImpactAr: `زيادة المشاركين النشطين بـ ~${Math.round(participation * 0.15)} طالب`,
      projectedImpactEn: `~${Math.round(participation * 0.15)} more active participants`,
      confidence: "MEDIUM",
      method: "competition_entry_uplift_15pct",
    },
    {
      id: "sim-volunteer-plus-20",
      scenarioAr: "زيادة التطوع 20%",
      scenarioEn: "Increase volunteer hours by 20%",
      changePct: 20,
      metric: "avgStudentSuccessIndex",
      currentValue: avgSuccess,
      projectedValue: volunteerBoost,
      projectedImpactAr: `تحسين طفيف في مؤشر النجاح إلى ${volunteerBoost}`,
      projectedImpactEn: `Modest success index improvement to ${volunteerBoost}`,
      confidence: "LOW",
      method: "volunteer_hours_elasticity_0.05",
    },
    {
      id: "sim-excellence-target",
      scenarioAr: "تنفيذ جميع الإجراءات عالية الأولوية",
      scenarioEn: "Execute all high-priority actions",
      changePct: 0,
      metric: "schoolExcellenceIndex",
      currentValue: intelligence.schoolExcellence.excellenceIndex,
      projectedValue: clamp(intelligence.schoolExcellence.excellenceIndex + 8),
      projectedImpactAr: "تحسين مؤشر تميز المدرسة بنحو 8 نقاط عند التنفيذ الكامل",
      projectedImpactEn: "School excellence index may improve by ~8 points with full execution",
      confidence: "LOW",
      method: "high_priority_bundle_assumption",
    },
  ];
};
