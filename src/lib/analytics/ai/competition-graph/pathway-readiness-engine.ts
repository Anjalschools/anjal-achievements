/**
 * pathway-readiness-engine.ts
 * Assesses whether a student is ready for the next node in each pathway.
 */
import type { LongitudinalProfile } from "../activity-intelligence/longitudinal-intelligence";
import type { StudentGraphScores } from "./graph-scoring-engine";
import { NODE_BY_KEY } from "./competition-graph-registry";
import type { StudentPathwayPosition } from "./competition-pathway-engine";

export type PathwayReadinessResult = {
  pathwayKey: string;
  nextNodeKey: string | null;
  readinessScore: number;   // 0–100
  readinessLabel: "ready" | "nearly_ready" | "not_ready";
  blockers: string[];
  accelerators: string[];
};

export const assessPathwayReadiness = (
  profile: LongitudinalProfile,
  position: StudentPathwayPosition,
  scores: StudentGraphScores
): PathwayReadinessResult => {
  const blockers: string[] = [];
  const accelerators: string[] = [];
  let readinessScore = 0;

  if (!position.nextNodeKey) {
    return {
      pathwayKey: position.pathwayKey,
      nextNodeKey: null,
      readinessScore: 100,
      readinessLabel: "ready",
      blockers: [],
      accelerators: ["Pathway fully completed"],
    };
  }

  const node = NODE_BY_KEY.get(position.nextNodeKey);

  // Base signal from completion progress
  readinessScore += position.completionPct * 0.4;

  // Progression trend bonus
  if (profile.progression.trend === "accelerating") {
    readinessScore += 20;
    accelerators.push("Accelerating performance trend");
  } else if (profile.progression.trend === "improving") {
    readinessScore += 10;
    accelerators.push("Improving performance");
  } else if (profile.progression.trend === "declining") {
    readinessScore -= 15;
    blockers.push("Recent performance decline");
  }

  // Continuity
  if (profile.progression.continuityScore >= 80) {
    readinessScore += 10;
    accelerators.push("Strong activity continuity");
  } else if (profile.progression.continuityScore < 40) {
    blockers.push("Inconsistent participation history");
  }

  // Momentum
  if (profile.progression.momentum === "high") readinessScore += 15;
  else if (profile.progression.momentum === "low") readinessScore -= 5;

  // Node-specific checks
  if (node?.requiresMawhiba && !profile.timeline.events.some((e) => e.activityKey === "mawhiba_discovery")) {
    blockers.push("Mawhiba discovery required");
    readinessScore -= 20;
  }

  if (node?.requiresInternational) {
    const hasIntl = ["sat", "ielts"].some(
      (k) => new Set(profile.timeline.events.map((e) => e.activityKey)).has(k)
    );
    if (!hasIntl) {
      blockers.push("International track prerequisites not met");
      readinessScore -= 10;
    }
  }

  // Quality signal
  if (profile.progression.peakQuality >= 75) {
    readinessScore += 10;
    accelerators.push("High peak achievement quality");
  }

  readinessScore = Math.max(0, Math.min(100, Math.round(readinessScore)));

  const readinessLabel: PathwayReadinessResult["readinessLabel"] =
    readinessScore >= 65 ? "ready"
    : readinessScore >= 40 ? "nearly_ready"
    : "not_ready";

  return {
    pathwayKey: position.pathwayKey,
    nextNodeKey: position.nextNodeKey,
    readinessScore,
    readinessLabel,
    blockers,
    accelerators,
  };
};
