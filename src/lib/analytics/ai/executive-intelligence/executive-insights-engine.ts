/**
 * executive-insights-engine.ts
 * Top-level orchestrator — calls all sub-engines and deduplicates insights.
 */
import type { ExecutiveInsight, InstitutionalSnapshot } from "./executive-insight-types";
import { detectSchoolGrowthInsights } from "./school-growth-engine";
import { detectWeakStageInsights } from "./weak-stage-detector";
import { detectEarlyTalents } from "./talent-discovery-engine";
import { detectRisks } from "./risk-detection-engine";
import { detectOpportunities } from "./executive-opportunity-detector";
import { detectAnomalies } from "./anomaly-detection-engine";

const SEVERITY_RANK: Record<string, number> = {
  critical: 5, high: 4, medium: 3, low: 2, info: 1,
};

export type ExecutiveInsightBundle = {
  insights: ExecutiveInsight[];
  counts: Record<string, number>;
  topInsights: ExecutiveInsight[];
  generatedAt: string;
};

export const buildExecutiveInsights = (
  snapshot: InstitutionalSnapshot,
  opts?: { maxInsights?: number }
): ExecutiveInsightBundle => {
  const max = opts?.maxInsights ?? 50;
  const raw: ExecutiveInsight[] = [
    ...detectSchoolGrowthInsights(snapshot),
    ...detectWeakStageInsights(snapshot),
    ...detectEarlyTalents(snapshot),
    ...detectRisks(snapshot),
    ...detectOpportunities(snapshot),
    ...detectAnomalies(snapshot),
  ];

  // Deduplicate: same type + entity keeps highest severity
  const deduped = new Map<string, ExecutiveInsight>();
  for (const ins of raw) {
    const key = `${ins.insightType}:${ins.affectedEntity}`;
    const existing = deduped.get(key);
    if (!existing || SEVERITY_RANK[ins.severity]! > SEVERITY_RANK[existing.severity]!) {
      deduped.set(key, ins);
    }
  }

  const sorted = [...deduped.values()].sort(
    (a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
  );

  const counts: Record<string, number> = {};
  for (const ins of sorted) {
    counts[ins.insightType] = (counts[ins.insightType] ?? 0) + 1;
  }

  return {
    insights: sorted.slice(0, max),
    counts,
    topInsights: sorted.slice(0, 5),
    generatedAt: new Date().toISOString(),
  };
};
