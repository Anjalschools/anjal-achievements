/**
 * activity-progression-engine.ts
 * Derives momentum, trajectory, and growth signals from a student timeline.
 */
import type { ActivityTimeline } from "./activity-timeline-builder";

export type ProgressionTrend =
  | "accelerating"   // quality rising two+ consecutive years
  | "improving"      // rising but not consecutive
  | "stable"         // flat ±15
  | "declining"      // falling
  | "volatile"       // large swings
  | "emerging";      // < 2 years of data

export type AchievementMomentum = "high" | "medium" | "low" | "none";

export type StudentProgression = {
  trend: ProgressionTrend;
  momentum: AchievementMomentum;
  /** Average quality score across all events */
  avgQuality: number;
  /** Best single-year quality score */
  peakQuality: number;
  /** Most recent year quality average */
  recentQuality: number;
  /** Year-over-year quality deltas (ordered) */
  yoyDeltas: number[];
  consecutiveImprovement: number;   // years
  continuityScore: number;          // 0–100
  specializationDepth: number;      // unique activities
  olympiadTrajectory: "strong" | "building" | "weak" | "none";
  futurePotential: "high" | "medium" | "low";
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

const avgQualityForYear = (
  timeline: ActivityTimeline,
  year: number
): number => {
  const evs = timeline.events.filter((e) => e.year === year);
  if (evs.length === 0) return 0;
  return evs.reduce((s, e) => s + e.qualityScore, 0) / evs.length;
};

const OLYMPIAD_KEYS = new Set([
  "nasmo",
  "mawhiba_discovery",
  "olympiad_training",
  "kaust_math",
  "kangaroo",
  "bebras",
]);

export const buildStudentProgression = (
  timeline: ActivityTimeline
): StudentProgression => {
  const { events, activeYears, yearSpan } = timeline;

  if (events.length === 0) {
    return {
      trend: "emerging",
      momentum: "none",
      avgQuality: 0,
      peakQuality: 0,
      recentQuality: 0,
      yoyDeltas: [],
      consecutiveImprovement: 0,
      continuityScore: 0,
      specializationDepth: 0,
      olympiadTrajectory: "none",
      futurePotential: "low",
    };
  }

  const allScores = events.map((e) => e.qualityScore);
  const avgQuality = clamp(allScores.reduce((s, q) => s + q, 0) / allScores.length);
  const peakQuality = Math.max(...allScores);

  const recentYear = activeYears[activeYears.length - 1]!;
  const recentQuality = avgQualityForYear(timeline, recentYear);

  // year-over-year deltas
  const yoyDeltas: number[] = [];
  for (let i = 1; i < activeYears.length; i++) {
    const prev = avgQualityForYear(timeline, activeYears[i - 1]!);
    const curr = avgQualityForYear(timeline, activeYears[i]!);
    yoyDeltas.push(curr - prev);
  }

  // consecutive improvement streak
  let consecutiveImprovement = 0;
  for (let i = yoyDeltas.length - 1; i >= 0; i--) {
    if (yoyDeltas[i]! > 2) consecutiveImprovement++;
    else break;
  }

  // trend classification
  let trend: ProgressionTrend = "emerging";
  if (activeYears.length < 2) {
    trend = "emerging";
  } else {
    const positiveCount = yoyDeltas.filter((d) => d > 2).length;
    const negativeCount = yoyDeltas.filter((d) => d < -2).length;
    const volatileCount = yoyDeltas.filter((d) => Math.abs(d) > 25).length;

    if (volatileCount >= 2) trend = "volatile";
    else if (consecutiveImprovement >= 2) trend = "accelerating";
    else if (positiveCount > negativeCount && positiveCount >= 1) trend = "improving";
    else if (negativeCount > positiveCount) trend = "declining";
    else trend = "stable";
  }

  // momentum
  const momentum: AchievementMomentum =
    recentQuality >= 75 && trend !== "declining" ? "high"
    : recentQuality >= 50 || trend === "improving" ? "medium"
    : recentQuality >= 25 ? "low"
    : "none";

  // continuity: % of possible annual gaps filled
  const possibleYears = yearSpan > 0 ? yearSpan : 1;
  const continuityScore = clamp(Math.round((activeYears.length / possibleYears) * 100));

  // specialization
  const uniqueKeys = new Set(events.map((e) => e.activityKey));
  const specializationDepth = uniqueKeys.size;

  // olympiad trajectory
  const olympiadEvents = events.filter((e) => OLYMPIAD_KEYS.has(e.activityKey));
  const olympiadTrajectory: StudentProgression["olympiadTrajectory"] =
    olympiadEvents.length === 0 ? "none"
    : olympiadEvents.some((e) => e.qualityScore >= 75) ? "strong"
    : olympiadEvents.length >= 2 ? "building"
    : "weak";

  // future potential
  const futurePotential: StudentProgression["futurePotential"] =
    trend === "accelerating" && peakQuality >= 70 ? "high"
    : trend === "improving" || (momentum === "medium" && peakQuality >= 50) ? "medium"
    : "low";

  return {
    trend,
    momentum,
    avgQuality,
    peakQuality,
    recentQuality,
    yoyDeltas,
    consecutiveImprovement,
    continuityScore,
    specializationDepth,
    olympiadTrajectory,
    futurePotential,
  };
};
