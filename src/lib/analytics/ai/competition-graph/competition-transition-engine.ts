/**
 * competition-transition-engine.ts
 * Analyzes transitions between competitions and scores them against graph edges.
 */
import type { CompetitionHistory } from "../activity-intelligence/competition-history-engine";
import {
  EDGES_FROM,
  NODE_BY_KEY,
  type CompetitionEdge,
} from "./competition-graph-registry";

export type TransitionAnalysis = {
  fromKey: string;
  toKey: string;
  isNaturalProgression: boolean;  // matches a known edge
  graphWeight: number;            // edge weight or 0
  crossDomain: boolean;           // from → to spans different domains
  timeDeltaYears: number;
};

export type TransitionReport = {
  analyses: TransitionAnalysis[];
  naturalProgressionCount: number;
  naturalProgressionRate: number;
  avgGraphWeight: number;
};

export const analyzeCompetitionTransitions = (
  history: CompetitionHistory
): TransitionReport => {
  const analyses: TransitionAnalysis[] = [];

  for (const t of history.transitions) {
    const edges = EDGES_FROM.get(t.fromKey) ?? [];
    const matchingEdge = edges.find((e) => e.to === t.toKey);
    const fromNode = NODE_BY_KEY.get(t.fromKey);
    const toNode = NODE_BY_KEY.get(t.toKey);

    const crossDomain =
      !!fromNode && !!toNode &&
      !fromNode.domains.some((d) => toNode.domains.includes(d));

    analyses.push({
      fromKey: t.fromKey,
      toKey: t.toKey,
      isNaturalProgression: !!matchingEdge,
      graphWeight: matchingEdge?.weight ?? 0,
      crossDomain,
      timeDeltaYears: t.toYear - t.fromYear,
    });
  }

  const natural = analyses.filter((a) => a.isNaturalProgression);
  const totalWeight = natural.reduce((s, a) => s + a.graphWeight, 0);

  return {
    analyses,
    naturalProgressionCount: natural.length,
    naturalProgressionRate:
      analyses.length > 0
        ? Math.round((natural.length / analyses.length) * 100)
        : 0,
    avgGraphWeight:
      natural.length > 0 ? Math.round(totalWeight / natural.length) : 0,
  };
};
