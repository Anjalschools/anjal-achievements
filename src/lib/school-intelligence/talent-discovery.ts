import type { StudentSuccessGraphNode, TalentDiscoveryRow } from "@/lib/school-intelligence/school-intelligence-types";

export const buildTalentDiscovery = (nodes: StudentSuccessGraphNode[]): TalentDiscoveryRow[] => {
  const rows: TalentDiscoveryRow[] = [];

  for (const node of nodes) {
    if (node.recentTrend === "accelerating" || (node.growthIndex != null && node.growthIndex >= 1.2)) {
      rows.push({
        studentId: node.studentId,
        fullName: node.fullNameAr || node.fullNameEn,
        talentType: "rapid_growth",
        successIndex: node.successIndex,
        detailAr: `نمو سريع — مؤشر النجاح ${node.successIndex}/100`,
        detailEn: `Rapid growth — success index ${node.successIndex}/100`,
        evidence: [
          { label: "growthIndex", value: node.growthIndex ?? 0 },
          { label: "trend", value: node.recentTrend },
          { label: "successIndex", value: node.successIndex },
        ],
      });
    }
  }

  const highPotential = nodes.filter(
    (n) =>
      n.successIndex >= 55 &&
      n.distinctActivityCount <= 2 &&
      n.subScores.universityReadiness >= 50 &&
      n.recordCount >= 1
  );
  for (const node of highPotential.slice(0, 20)) {
    rows.push({
      studentId: node.studentId,
      fullName: node.fullNameAr || node.fullNameEn,
      talentType: "underutilized",
      successIndex: node.successIndex,
      detailAr: `موهبة غير مستغلة — جاهزية عالية مع مشاركات محدودة (${node.distinctActivityCount} نشاط)`,
      detailEn: `Underutilized talent — high readiness with limited activities (${node.distinctActivityCount})`,
      evidence: [
        { label: "distinctActivities", value: node.distinctActivityCount },
        { label: "universityReadiness", value: node.subScores.universityReadiness },
        { label: "successIndex", value: node.successIndex },
      ],
    });
  }

  const programCandidates = nodes
    .filter(
      (n) =>
        n.successIndex >= 70 &&
        (n.isMawhiba || n.subScores.universityReadiness >= 65) &&
        n.trainingHours >= 10
    )
    .slice(0, 25);

  for (const node of programCandidates) {
    rows.push({
      studentId: node.studentId,
      fullName: node.fullNameAr || node.fullNameEn,
      talentType: "program_candidate",
      successIndex: node.successIndex,
      detailAr: `مرشح للبرامج النوعية — مؤشر ${node.successIndex}/100`,
      detailEn: `Special program candidate — index ${node.successIndex}/100`,
      evidence: [
        { label: "trainingHours", value: node.trainingHours },
        { label: "universityReadiness", value: node.subScores.universityReadiness },
        { label: "isMawhiba", value: node.isMawhiba ? "yes" : "no" },
      ],
    });
  }

  const seen = new Set<string>();
  return rows
    .filter((r) => {
      const key = `${r.studentId}-${r.talentType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.successIndex - a.successIndex)
    .slice(0, 40);
};
