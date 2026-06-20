import type { InterventionRow, StudentSuccessGraphNode } from "@/lib/school-intelligence/school-intelligence-types";
import { traceSchoolIntelligenceSectionSync } from "@/lib/school-intelligence/school-intelligence-section-tracer";

export const buildInterventions = (nodes: StudentSuccessGraphNode[]): InterventionRow[] =>
  traceSchoolIntelligenceSectionSync("buildInterventionEngine", "intervention_engine", () => {
  const rows: InterventionRow[] = [];

  for (const node of nodes) {
    if (node.recentTrend === "declining") {
      rows.push({
        studentId: node.studentId,
        fullName: node.fullNameAr || node.fullNameEn,
        interventionType: "activity_decline",
        severity: "high",
        detailAr: `انخفاض في النشاط — مؤشر النجاح ${node.successIndex}/100`,
        detailEn: `Activity decline — success index ${node.successIndex}/100`,
        evidence: [
          { label: "trend", value: node.recentTrend },
          { label: "growthIndex", value: node.growthIndex ?? 0 },
          { label: "recordCount", value: node.recordCount },
        ],
      });
    }

    if (node.participationCount === 0 && node.grade) {
      rows.push({
        studentId: node.studentId,
        fullName: node.fullNameAr || node.fullNameEn,
        interventionType: "participation_stop",
        severity: "medium",
        detailAr: "توقفت المشاركات — لا إنجازات مسجّلة",
        detailEn: "Participation stopped — no recorded achievements",
        evidence: [
          { label: "participationCount", value: 0 },
          { label: "grade", value: node.grade },
        ],
      });
    }

    if (
      node.subScores.universityReadiness < 35 &&
      node.subScores.careerReadiness < 35 &&
      node.recordCount > 0
    ) {
      rows.push({
        studentId: node.studentId,
        fullName: node.fullNameAr || node.fullNameEn,
        interventionType: "readiness_drop",
        severity: "medium",
        detailAr: `تراجع الجاهزية — جامعي ${node.subScores.universityReadiness} / مهني ${node.subScores.careerReadiness}`,
        detailEn: `Readiness drop — university ${node.subScores.universityReadiness} / career ${node.subScores.careerReadiness}`,
        evidence: [
          { label: "universityReadiness", value: node.subScores.universityReadiness },
          { label: "careerReadiness", value: node.subScores.careerReadiness },
        ],
      });
    }
  }

  return rows
    .sort((a, b) => {
      const sev = { high: 3, medium: 2, low: 1 };
      return sev[b.severity] - sev[a.severity];
    })
    .slice(0, 50);
});
