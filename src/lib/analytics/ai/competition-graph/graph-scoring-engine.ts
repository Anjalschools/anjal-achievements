/**
 * graph-scoring-engine.ts
 * Computes pathway analytics scores for a student.
 */
import type { LongitudinalProfile } from "../activity-intelligence/longitudinal-intelligence";
import { COMPETITION_NODES, NODE_BY_KEY } from "./competition-graph-registry";
import {
  resolveAllPathwayPositions,
  type StudentPathwayPosition,
} from "./competition-pathway-engine";

export type StudentGraphScores = {
  /** 0–100: how far along the highest pathway the student is */
  competitionProgressionScore: number;
  /** 0–100: how well the student's history aligns with a clear pathway */
  pathwayMatchScore: number;
  /** 0–100: combined signals pointing toward olympiad readiness */
  olympiadPotential: number;
  /** 0–100: STEM readiness based on tier of STEM nodes completed */
  stemReadiness: number;
  /** 0–100: research pathway readiness */
  researchReadiness: number;
  /** 0–100: international track potential */
  internationalTrackPotential: number;
  dominantPathwayKey: string | null;
  positions: StudentPathwayPosition[];
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export const computeStudentGraphScores = (
  profile: LongitudinalProfile
): StudentGraphScores => {
  const activityKeys = new Set(
    profile.timeline.events.map((e) => e.activityKey)
  );
  const gradeNum = parseInt(
    profile.timeline.events[0]?.achievementLevel ?? "0",
    10
  ) || 0;

  const positions = resolveAllPathwayPositions(activityKeys, gradeNum);

  // Progression score: best pathway completion %
  const competitionProgressionScore = positions.length > 0
    ? clamp(Math.max(...positions.map((p) => p.completionPct)))
    : 0;

  // Pathway match: average completion of started pathways weighted by node count
  const pathwayMatchScore = positions.length > 0
    ? clamp(positions.reduce((s, p) => s + p.completionPct, 0) / positions.length)
    : 0;

  // Olympiad potential
  const olympiadSignals: number[] = [];
  if (activityKeys.has("nasmo"))            olympiadSignals.push(30);
  if (activityKeys.has("mawhiba_discovery")) olympiadSignals.push(20);
  if (activityKeys.has("olympiad_training")) olympiadSignals.push(40);
  if (activityKeys.has("kaust_math"))        olympiadSignals.push(15);
  if (activityKeys.has("math_olympiad"))     olympiadSignals.push(50);
  if (profile.progression.olympiadTrajectory === "strong")   olympiadSignals.push(25);
  if (profile.progression.olympiadTrajectory === "building") olympiadSignals.push(12);
  if (profile.progression.trend === "accelerating")          olympiadSignals.push(10);
  const olympiadPotential = clamp(Math.min(olympiadSignals.reduce((s, n) => s + n, 0), 100));

  // STEM readiness: weighted by tier of STEM-tagged nodes completed
  const stemNodes = COMPETITION_NODES.filter(
    (n) => n.pathwayTags.includes("stem_intro") || n.domains.includes("stem") || n.domains.includes("science")
  );
  const stemCompleted = stemNodes.filter((n) => activityKeys.has(n.key));
  const maxStemWeight = stemNodes.reduce((s, n) => s + n.tier * 20, 0) || 1;
  const earnedStemWeight = stemCompleted.reduce((s, n) => s + n.tier * 20, 0);
  const stemReadiness = clamp((earnedStemWeight / maxStemWeight) * 100);

  // Research readiness
  const researchSignals: number[] = [];
  if (activityKeys.has("ibdaa"))  researchSignals.push(35);
  if (activityKeys.has("srsi"))   researchSignals.push(50);
  if (activityKeys.has("misk"))   researchSignals.push(30);
  if (profile.density.nominationCount > 0) researchSignals.push(15);
  const researchReadiness = clamp(Math.min(researchSignals.reduce((s, n) => s + n, 0), 100));

  // International track potential
  const intlSignals: number[] = [];
  if (activityKeys.has("sat"))   intlSignals.push(30);
  if (activityKeys.has("ielts")) intlSignals.push(20);
  if (activityKeys.has("srsi"))  intlSignals.push(30);
  if (activityKeys.has("misk"))  intlSignals.push(25);
  const internationalTrackPotential = clamp(Math.min(intlSignals.reduce((s, n) => s + n, 0), 100));

  // Dominant pathway
  const dominantPosition = [...positions].sort(
    (a, b) => b.completionPct - a.completionPct
  )[0];

  return {
    competitionProgressionScore,
    pathwayMatchScore,
    olympiadPotential,
    stemReadiness,
    researchReadiness,
    internationalTrackPotential,
    dominantPathwayKey: dominantPosition?.pathwayKey ?? null,
    positions,
  };
};
