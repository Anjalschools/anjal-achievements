import type { StudentSuccessGraphNode, TalentDiscoveryRow } from "@/lib/school-intelligence/school-intelligence-types";

export type TalentDiscoveryDiagnosticsStatus = "success" | "no_data";

export type TalentDiscoveryDiagnostics = {
  status: TalentDiscoveryDiagnosticsStatus;
  candidateCount: number;
  filteredCount: number;
  threshold: {
    rapidGrowthGrowthIndex: number;
    underutilizedSuccessIndex: number;
    underutilizedMaxActivities: number;
    underutilizedUniversityReadiness: number;
    programCandidateSuccessIndex: number;
    programCandidateUniversityReadiness: number;
    programCandidateTrainingHours: number;
  };
  missingFields: string[];
  reasons: string[];
};

export const TALENT_DISCOVERY_THRESHOLDS = {
  rapidGrowthGrowthIndex: 1.2,
  underutilizedSuccessIndex: 55,
  underutilizedMaxActivities: 2,
  underutilizedUniversityReadiness: 50,
  programCandidateSuccessIndex: 70,
  programCandidateUniversityReadiness: 65,
  programCandidateTrainingHours: 10,
} as const;

const collectMissingFields = (nodes: StudentSuccessGraphNode[]): string[] => {
  const missing = new Set<string>();
  if (nodes.some((node) => node.growthIndex == null)) missing.add("growthIndex");
  if (nodes.some((node) => node.trainingHours <= 0)) missing.add("trainingHours");
  if (nodes.some((node) => node.recordCount <= 0)) missing.add("achievements");
  if (nodes.some((node) => node.participationCount <= 0)) missing.add("participationHistory");
  if (nodes.some((node) => node.successIndex <= 0)) missing.add("successIndex");
  return [...missing];
};

const buildNoDataReasons = (input: {
  candidateCount: number;
  rapidGrowthMatches: number;
  underutilizedMatches: number;
  programCandidateMatches: number;
  missingFields: string[];
}): string[] => {
  if (input.candidateCount === 0) {
    return ["empty_student_graph"];
  }

  const reasons: string[] = [];
  if (input.rapidGrowthMatches === 0) {
    reasons.push("no_accelerating_growth_or_high_growth_index");
  }
  if (input.underutilizedMatches === 0) {
    reasons.push("no_underutilized_high_potential_profiles");
  }
  if (input.programCandidateMatches === 0) {
    reasons.push("no_program_candidates_with_training_hours");
  }
  if (input.missingFields.includes("growthIndex")) {
    reasons.push("missing_growth_scoring");
  }
  if (input.missingFields.includes("trainingHours")) {
    reasons.push("missing_training_participation");
  }
  if (input.missingFields.includes("achievements")) {
    reasons.push("missing_achievement_history");
  }
  return reasons;
};

export const buildTalentDiscoveryWithDiagnostics = (
  nodes: StudentSuccessGraphNode[]
): { rows: TalentDiscoveryRow[]; diagnostics: TalentDiscoveryDiagnostics } => {
  const rows: TalentDiscoveryRow[] = [];
  const missingFields = collectMissingFields(nodes);
  let rapidGrowthMatches = 0;
  let underutilizedMatches = 0;
  let programCandidateMatches = 0;

  for (const node of nodes) {
    if (
      node.recentTrend === "accelerating" ||
      (node.growthIndex != null && node.growthIndex >= TALENT_DISCOVERY_THRESHOLDS.rapidGrowthGrowthIndex)
    ) {
      rapidGrowthMatches += 1;
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
    (node) =>
      node.successIndex >= TALENT_DISCOVERY_THRESHOLDS.underutilizedSuccessIndex &&
      node.distinctActivityCount <= TALENT_DISCOVERY_THRESHOLDS.underutilizedMaxActivities &&
      node.subScores.universityReadiness >= TALENT_DISCOVERY_THRESHOLDS.underutilizedUniversityReadiness &&
      node.recordCount >= 1
  );
  underutilizedMatches = highPotential.length;

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

  const programCandidates = nodes.filter(
    (node) =>
      node.successIndex >= TALENT_DISCOVERY_THRESHOLDS.programCandidateSuccessIndex &&
      (node.isMawhiba ||
        node.subScores.universityReadiness >= TALENT_DISCOVERY_THRESHOLDS.programCandidateUniversityReadiness) &&
      node.trainingHours >= TALENT_DISCOVERY_THRESHOLDS.programCandidateTrainingHours
  );
  programCandidateMatches = programCandidates.length;

  for (const node of programCandidates.slice(0, 25)) {
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
  const dedupedRows = rows
    .filter((row) => {
      const key = `${row.studentId}-${row.talentType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.successIndex - a.successIndex)
    .slice(0, 40);

  const filteredCount = dedupedRows.length;
  const reasons =
    filteredCount === 0
      ? buildNoDataReasons({
          candidateCount: nodes.length,
          rapidGrowthMatches,
          underutilizedMatches,
          programCandidateMatches,
          missingFields,
        })
      : [];

  return {
    rows: dedupedRows,
    diagnostics: {
      status: filteredCount > 0 ? "success" : "no_data",
      candidateCount: nodes.length,
      filteredCount,
      threshold: { ...TALENT_DISCOVERY_THRESHOLDS },
      missingFields,
      reasons,
    },
  };
};

export const buildTalentDiscovery = (nodes: StudentSuccessGraphNode[]): TalentDiscoveryRow[] =>
  buildTalentDiscoveryWithDiagnostics(nodes).rows;
