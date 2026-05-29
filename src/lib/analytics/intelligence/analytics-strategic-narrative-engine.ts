/**
 * Strategic narrative engine — builds semantic insights from narratives + bundles.
 */

import type { ExecutiveNarrative } from "@/lib/analytics/analytics-narrative-engine";
import { normalizeExecutiveNarratives } from "@/lib/analytics/intelligence/analytics-insight-normalizer";
import type { ExecutiveSemanticInsight } from "@/lib/analytics/intelligence/analytics-narrative-schema";
import { compareSeverity } from "@/lib/analytics/intelligence/analytics-insight-severity";

export const buildStrategicSemanticInsights = (input: {
  narratives: ExecutiveNarrative[];
  exploratoryMode?: boolean;
  maxCards?: number;
}): ExecutiveSemanticInsight[] => {
  const normalized = normalizeExecutiveNarratives(input.narratives, {
    exploratoryMode: input.exploratoryMode,
  });
  return normalized
    .sort((a, b) => compareSeverity(b.severity, a.severity))
    .slice(0, input.maxCards ?? 12);
};

export const groupInsightsByCategory = (
  insights: ExecutiveSemanticInsight[]
): Record<string, ExecutiveSemanticInsight[]> => {
  const groups: Record<string, ExecutiveSemanticInsight[]> = {};
  for (const ins of insights) {
    const key = ins.intelligenceCategory;
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(ins);
  }
  return groups;
};
