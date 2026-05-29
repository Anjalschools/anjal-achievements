/**
 * longitudinal-intelligence.ts
 * Top-level orchestration: assembles full longitudinal profile for a student.
 */
import type { RawActivityRecord } from "./student-activity-loader";
import { buildActivityTimeline, type ActivityTimeline } from "./activity-timeline-builder";
import { buildStudentProgression, type StudentProgression } from "./activity-progression-engine";
import { buildAchievementDensity, type DensityBreakdown } from "./achievement-density-engine";
import {
  detectParticipationPatterns,
  type ParticipationPattern,
} from "./participation-pattern-engine";
import {
  buildCompetitionHistory,
  type CompetitionHistory,
} from "./competition-history-engine";

export type LongitudinalProfile = {
  userId: string;
  timeline: ActivityTimeline;
  progression: StudentProgression;
  density: DensityBreakdown;
  patterns: ParticipationPattern;
  competitionHistory: CompetitionHistory;
  growthTrend: StudentProgression["trend"];
  achievementMomentum: StudentProgression["momentum"];
  olympiadTrajectory: StudentProgression["olympiadTrajectory"];
  futurePotential: StudentProgression["futurePotential"];
  summary: string;
};

export const buildLongitudinalProfile = (
  userId: string,
  records: RawActivityRecord[]
): LongitudinalProfile => {
  const timeline = buildActivityTimeline(userId, records);
  const progression = buildStudentProgression(timeline);
  const density = buildAchievementDensity(records);
  const patterns = detectParticipationPatterns(timeline, records);
  const competitionHistory = buildCompetitionHistory(records);

  const summary = [
    `Trend: ${progression.trend}`,
    `Momentum: ${progression.momentum}`,
    `Avg quality: ${Math.round(progression.avgQuality)}`,
    `Medal density: ${density.medalDensityPct}%`,
    `Specialization: ${patterns.dominantDomain || "varied"}`,
    `Olympiad: ${progression.olympiadTrajectory}`,
  ].join(" | ");

  return {
    userId,
    timeline,
    progression,
    density,
    patterns,
    competitionHistory,
    growthTrend: progression.trend,
    achievementMomentum: progression.momentum,
    olympiadTrajectory: progression.olympiadTrajectory,
    futurePotential: progression.futurePotential,
    summary,
  };
};
