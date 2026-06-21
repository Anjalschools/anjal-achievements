export type TalentDiscoveryThresholdConfig = {
  minimumSSI: number;
  minimumGrowthIndex: number;
  minimumParticipationCount: number;
  minimumReadiness: number;
  usePercentileThresholds: boolean;
  /** Percentile cutoff for adaptive mode (90 = top 10%). */
  percentileCutoff: number;
};

export const TALENT_DISCOVERY_DEFAULTS: TalentDiscoveryThresholdConfig = {
  minimumSSI: 20,
  minimumGrowthIndex: 1.05,
  minimumParticipationCount: 2,
  minimumReadiness: 40,
  usePercentileThresholds: true,
  percentileCutoff: 90,
};

export type ResolvedTalentDiscoveryThresholds = {
  mode: "fixed" | "percentile";
  rapidGrowthGrowthIndex: number;
  underutilizedSuccessIndex: number;
  underutilizedMaxActivities: number;
  underutilizedUniversityReadiness: number;
  programCandidateSuccessIndex: number;
  programCandidateUniversityReadiness: number;
  programCandidateTrainingHours: number;
  minimumParticipationCount: number;
};

const percentileAt = (values: number[], cutoff: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((cutoff / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
};

export const resolveTalentDiscoveryThresholds = (
  input: {
    successIndexes: number[];
    growthIndexes: number[];
    participationCounts: number[];
    readinessScores: number[];
  },
  config: TalentDiscoveryThresholdConfig = TALENT_DISCOVERY_DEFAULTS
): ResolvedTalentDiscoveryThresholds => {
  const fixed: ResolvedTalentDiscoveryThresholds = {
    mode: "fixed",
    rapidGrowthGrowthIndex: config.minimumGrowthIndex,
    underutilizedSuccessIndex: config.minimumSSI,
    underutilizedMaxActivities: 2,
    underutilizedUniversityReadiness: config.minimumReadiness,
    programCandidateSuccessIndex: Math.max(config.minimumSSI + 5, 30),
    programCandidateUniversityReadiness: config.minimumReadiness,
    programCandidateTrainingHours: 8,
    minimumParticipationCount: config.minimumParticipationCount,
  };

  if (!config.usePercentileThresholds) return fixed;

  const ssiCutoff = percentileAt(input.successIndexes.filter((v) => v > 0), config.percentileCutoff);
  const growthCutoff = percentileAt(
    input.growthIndexes.filter((v) => Number.isFinite(v)),
    config.percentileCutoff
  );
  const readinessCutoff = percentileAt(
    input.readinessScores.filter((v) => v > 0),
    config.percentileCutoff
  );

  return {
    mode: "percentile",
    rapidGrowthGrowthIndex: Math.max(
      config.minimumGrowthIndex,
      growthCutoff > 0 ? growthCutoff : config.minimumGrowthIndex
    ),
    underutilizedSuccessIndex: Math.max(config.minimumSSI, ssiCutoff),
    underutilizedMaxActivities: 2,
    underutilizedUniversityReadiness: Math.max(config.minimumReadiness, readinessCutoff),
    programCandidateSuccessIndex: Math.max(config.minimumSSI, ssiCutoff),
    programCandidateUniversityReadiness: Math.max(config.minimumReadiness, readinessCutoff),
    programCandidateTrainingHours: 8,
    minimumParticipationCount: config.minimumParticipationCount,
  };
};
