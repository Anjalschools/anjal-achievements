import type { StudentSuccessSubScores } from "@/lib/school-intelligence/school-intelligence-types";

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(n)));

export const computeTrainingScore = (trainingHours: number, approvedTrainingCount: number): number =>
  clamp(trainingHours * 1.2 + approvedTrainingCount * 10, 0, 100);

export const computeVolunteerScore = (volunteerHours: number): number => clamp(volunteerHours * 1.5, 0, 100);

export const computeConsistencyScore = (input: {
  growthIndex?: number;
  yearSpan?: number;
  distinctActivityCount: number;
  recordCount: number;
  recentTrend: string;
}): number => {
  const growthPart = input.growthIndex != null ? clamp(input.growthIndex * 25, 0, 35) : 10;
  const spanPart = clamp((input.yearSpan || 1) * 12, 0, 25);
  const diversityPart = clamp(input.distinctActivityCount * 8, 0, 25);
  const volumePart = clamp(input.recordCount * 2, 0, 15);
  const trendBonus =
    input.recentTrend === "accelerating" ? 15 : input.recentTrend === "improving" ? 10 : input.recentTrend === "declining" ? -10 : 0;
  return clamp(growthPart + spanPart + diversityPart + volumePart + trendBonus);
};

export const computeAchievementScore = (input: {
  achievementsScore: number;
  medalRatioPct: number;
  recordCount: number;
}): number => {
  if (input.achievementsScore > 0) return clamp(input.achievementsScore);
  return clamp(input.medalRatioPct * 0.55 + Math.min(input.recordCount, 20) * 2.5);
};

export const buildStudentSubScores = (input: {
  achievementsScore: number;
  skillsScore: number;
  careerReadiness: number;
  universityReadiness: number;
  trainingHours: number;
  volunteerHours: number;
  approvedTrainingCount: number;
  medalRatioPct: number;
  recordCount: number;
  distinctActivityCount: number;
  growthIndex?: number;
  yearSpan?: number;
  recentTrend: string;
}): StudentSuccessSubScores => ({
  achievementScore: computeAchievementScore({
    achievementsScore: input.achievementsScore,
    medalRatioPct: input.medalRatioPct,
    recordCount: input.recordCount,
  }),
  trainingScore: computeTrainingScore(input.trainingHours, input.approvedTrainingCount),
  volunteerScore: computeVolunteerScore(input.volunteerHours),
  skillScore: clamp(input.skillsScore),
  careerReadiness: clamp(input.careerReadiness),
  universityReadiness: clamp(input.universityReadiness),
  consistencyScore: computeConsistencyScore({
    growthIndex: input.growthIndex,
    yearSpan: input.yearSpan,
    distinctActivityCount: input.distinctActivityCount,
    recordCount: input.recordCount,
    recentTrend: input.recentTrend,
  }),
});

/** Weighted Student Success Index 0–100 (deterministic). */
export const computeStudentSuccessIndex = (sub: StudentSuccessSubScores): number =>
  clamp(
    sub.achievementScore * 0.2 +
      sub.trainingScore * 0.15 +
      sub.volunteerScore * 0.1 +
      sub.skillScore * 0.15 +
      sub.careerReadiness * 0.15 +
      sub.universityReadiness * 0.15 +
      sub.consistencyScore * 0.1
  );

export const formatSubScoreEvidence = (sub: StudentSuccessSubScores, index: number): string =>
  [
    `SSI=${index}`,
    `ach=${sub.achievementScore}`,
    `train=${sub.trainingScore}`,
    `vol=${sub.volunteerScore}`,
    `skill=${sub.skillScore}`,
    `career=${sub.careerReadiness}`,
    `uni=${sub.universityReadiness}`,
    `consistency=${sub.consistencyScore}`,
  ].join("; ");
