import type { StudentAchievementSummary } from "@/lib/partnerships/build-student-achievement-summary";
import type { RawActivityRecord } from "@/lib/analytics/ai/activity-intelligence/student-activity-loader";

export type CareerScoreInput = {
  achievementSummary: StudentAchievementSummary;
  achievementRecords: RawActivityRecord[];
  trainingHours: number;
  volunteerHours: number;
  trainingCount: number;
  avgTrainingRating: number | null;
  skillCount: number;
  initiativeCount: number;
  courseCount: number;
};

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(n)));

const distinctYears = (records: RawActivityRecord[]): number => {
  const years = new Set(records.map((r) => r.achievementYear).filter((y) => y > 0));
  return years.size;
};

const distinctCategories = (records: RawActivityRecord[]): number => {
  const keys = new Set(records.map((r) => r.canonicalActivityKey || r.achievementType).filter(Boolean));
  return keys.size;
};

export const computeUniversityReadinessScore = (input: CareerScoreInput): number => {
  const { achievementSummary, achievementRecords, trainingHours, volunteerHours } = input;
  const years = distinctYears(achievementRecords);
  const diversity = distinctCategories(achievementRecords);

  const achievementsFactor = clamp(achievementSummary.excellenceScore * 1.2, 0, 35);
  const trainingFactor = clamp(trainingHours * 0.8 + input.trainingCount * 8, 0, 20);
  const volunteerFactor = clamp(volunteerHours * 0.5, 0, 15);
  const continuityFactor = clamp(years * 8, 0, 15);
  const diversityFactor = clamp(diversity * 3, 0, 15);

  return clamp(achievementsFactor + trainingFactor + volunteerFactor + continuityFactor + diversityFactor);
};

export const computeCareerReadinessScore = (input: CareerScoreInput): number => {
  const trainingFactor = clamp(input.trainingCount * 12 + input.trainingHours * 0.6, 0, 30);
  const hoursFactor = clamp((input.trainingHours + input.volunteerHours) * 0.4, 0, 20);
  const ratingFactor = input.avgTrainingRating != null ? clamp(input.avgTrainingRating * 16, 0, 20) : 8;
  const skillsFactor = clamp(input.skillCount * 4, 0, 15);
  const initiativeFactor = clamp(input.initiativeCount * 6 + input.courseCount * 3, 0, 15);

  return clamp(trainingFactor + hoursFactor + ratingFactor + skillsFactor + initiativeFactor);
};

export const computeAchievementsScore = (summary: StudentAchievementSummary): number =>
  clamp(summary.excellenceScore * 1.5 + summary.medalCount * 5, 0, 100);

export const computeLeadershipScore = (records: RawActivityRecord[]): number => {
  const leadershipHits = records.filter((r) => {
    const text = `${r.activityLabelAr} ${r.activityLabelEn} ${r.achievementClassification}`.toLowerCase();
    return /lead|قيادة|president|رئيس|captain|قائد|initiative|مبادرة/.test(text);
  }).length;
  return clamp(leadershipHits * 15 + records.filter((r) => r.outcomeKey.includes("medal")).length * 3, 0, 100);
};

export const computeSkillsScore = (skillCount: number, courseCount: number): number =>
  clamp(skillCount * 5 + courseCount * 8, 0, 100);

export const computeAllCareerScores = (input: CareerScoreInput) => ({
  universityReadinessScore: computeUniversityReadinessScore(input),
  careerReadinessScore: computeCareerReadinessScore(input),
  achievementsScore: computeAchievementsScore(input.achievementSummary),
  leadershipScore: computeLeadershipScore(input.achievementRecords),
  skillsScore: computeSkillsScore(input.skillCount, input.courseCount),
});
