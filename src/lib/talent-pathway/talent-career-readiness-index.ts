import {
  careerReadinessIndexBandForScore,
  type CareerReadinessIndexBandKey,
} from "@/lib/talent-pathway/talent-pathway-constants";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export type TalentCareerReadinessInput = {
  achievementsScore?: number;
  trainingHours?: number;
  trainingCount?: number;
  avgTrainingRating?: number | null;
  leadershipActivities?: number;
  certificationCount?: number;
  participationQualityScore?: number;
  recommendationRatePct?: number;
};

export type TalentCareerReadinessIndex = {
  careerReadinessIndex: number;
  careerReadinessBand: CareerReadinessIndexBandKey;
  achievementsContribution: number;
  trainingContribution: number;
  leadershipContribution: number;
  certificationContribution: number;
  participationContribution: number;
};

export const computeTalentCareerReadinessIndex = (
  input: TalentCareerReadinessInput
): TalentCareerReadinessIndex => {
  const achievementsContribution = clamp((input.achievementsScore ?? 0) * 0.35);
  const trainingContribution = clamp(
    (input.trainingCount ?? 0) * 8 +
      (input.trainingHours ?? 0) * 0.35 +
      (input.avgTrainingRating != null ? input.avgTrainingRating * 8 : 0)
  );
  const leadershipContribution = clamp((input.leadershipActivities ?? 0) * 12);
  const certificationContribution = clamp((input.certificationCount ?? 0) * 10);
  const participationContribution = clamp(
    (input.participationQualityScore ?? 0) * 0.25 + (input.recommendationRatePct ?? 0) * 0.15
  );

  const careerReadinessIndex = clamp(
    achievementsContribution * 0.3 +
      trainingContribution * 0.25 +
      leadershipContribution * 0.15 +
      certificationContribution * 0.1 +
      participationContribution * 0.2
  );

  return {
    careerReadinessIndex,
    careerReadinessBand: careerReadinessIndexBandForScore(careerReadinessIndex),
    achievementsContribution,
    trainingContribution,
    leadershipContribution,
    certificationContribution,
    participationContribution,
  };
};
