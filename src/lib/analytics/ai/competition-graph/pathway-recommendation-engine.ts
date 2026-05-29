/**
 * pathway-recommendation-engine.ts
 * Produces next-step recommendations based on graph position and scores.
 */
import type { LongitudinalProfile } from "../activity-intelligence/longitudinal-intelligence";
import type { StudentGraphScores } from "./graph-scoring-engine";
import { NODE_BY_KEY, EDGES_FROM } from "./competition-graph-registry";
import type { StudentPathwayPosition } from "./competition-pathway-engine";

export type NextStepRecommendation = {
  activityKey: string;
  activityLabelAr: string;
  activityLabelEn: string;
  pathwayKey: string;
  pathwayLabelAr: string;
  reason: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  graphWeight: number;
  timeHorizon: "immediate" | "short_term" | "medium_term";
};

export const buildPathwayRecommendations = (
  profile: LongitudinalProfile,
  scores: StudentGraphScores
): NextStepRecommendation[] => {
  const recs: NextStepRecommendation[] = [];
  const studentKeys = new Set(profile.timeline.events.map((e) => e.activityKey));

  for (const pos of scores.positions) {
    if (!pos.nextNodeKey) continue;
    const node = NODE_BY_KEY.get(pos.nextNodeKey);
    if (!node) continue;

    // Check grade eligibility
    const gradeStr = profile.timeline.events[0]?.achievementLevel ?? "";
    const grade = parseInt(gradeStr, 10) || 0;
    if (grade > 0 && (grade < node.minGrade || grade > node.maxGrade)) continue;

    const edges = EDGES_FROM.get(pos.currentNodeKey ?? "") ?? [];
    const edge = edges.find((e) => e.to === pos.nextNodeKey);
    const weight = edge?.weight ?? 5;

    const confidence: NextStepRecommendation["confidence"] =
      pos.completionPct >= 50 && weight >= 8 ? "HIGH"
      : weight >= 6 ? "MEDIUM"
      : "LOW";

    const timeHorizon: NextStepRecommendation["timeHorizon"] =
      pos.completionPct >= 75 ? "immediate"
      : pos.completionPct >= 40 ? "short_term"
      : "medium_term";

    recs.push({
      activityKey: pos.nextNodeKey,
      activityLabelAr: node.labelAr,
      activityLabelEn: node.labelEn,
      pathwayKey: pos.pathwayKey,
      pathwayLabelAr: pos.pathwayLabelAr,
      reason: `Student completed ${pos.completedNodes.length}/${pos.completedNodes.length + 1} steps in ${pos.pathwayLabelAr}. Natural next step with graph weight ${weight}/10.`,
      confidence,
      graphWeight: weight,
      timeHorizon,
    });
  }

  // De-duplicate by activity key, keeping highest confidence
  const deduped = new Map<string, NextStepRecommendation>();
  for (const r of recs) {
    const existing = deduped.get(r.activityKey);
    const rankConf = (c: string) => c === "HIGH" ? 3 : c === "MEDIUM" ? 2 : 1;
    if (!existing || rankConf(r.confidence) > rankConf(existing.confidence)) {
      deduped.set(r.activityKey, r);
    }
  }

  return [...deduped.values()].sort((a, b) => b.graphWeight - a.graphWeight);
};
