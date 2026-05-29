/**
 * Recommendation prioritization — executive tiers, clusters, top-3 actions.
 */

import type {
  EducationalRecommendation,
  RecommendationSeverity,
} from "@/lib/analytics/analytics-recommendation-engine";

export type RecommendationPriorityTier =
  | "critical_actions"
  | "high_impact"
  | "medium_impact"
  | "informational";

export type PrioritizedRecommendationBundle = {
  executiveTop3: EducationalRecommendation[];
  byTier: Record<RecommendationPriorityTier, EducationalRecommendation[]>;
  bySeverity: Record<RecommendationSeverity, EducationalRecommendation[]>;
  clusters: Array<{
    clusterId: string;
    labelAr: string;
    labelEn: string;
    items: EducationalRecommendation[];
    maxSeverity: RecommendationSeverity;
    avgPriority: number;
  }>;
};

const severityRank: Record<RecommendationSeverity, number> = {
  critical: 4,
  high: 3,
  moderate: 2,
  info: 1,
};

const tierFromSeverity = (s: RecommendationSeverity): RecommendationPriorityTier => {
  if (s === "critical") return "critical_actions";
  if (s === "high") return "high_impact";
  if (s === "moderate") return "medium_impact";
  return "informational";
};

const sortRecs = (recs: EducationalRecommendation[]): EducationalRecommendation[] =>
  [...recs].sort((a, b) => {
    const sd = severityRank[b.severity] - severityRank[a.severity];
    if (sd !== 0) return sd;
    return b.priority - a.priority;
  });

export const prioritizeRecommendations = (
  recs: EducationalRecommendation[]
): PrioritizedRecommendationBundle => {
  const sorted = sortRecs(recs);
  const byTier: PrioritizedRecommendationBundle["byTier"] = {
    critical_actions: [],
    high_impact: [],
    medium_impact: [],
    informational: [],
  };
  const bySeverity: PrioritizedRecommendationBundle["bySeverity"] = {
    critical: [],
    high: [],
    moderate: [],
    info: [],
  };

  for (const r of sorted) {
    byTier[tierFromSeverity(r.severity)].push(r);
    bySeverity[r.severity].push(r);
  }

  const clusterMap = new Map<string, EducationalRecommendation[]>();
  for (const r of sorted) {
    const key = r.uiCategory;
    const list = clusterMap.get(key) ?? [];
    list.push(r);
    clusterMap.set(key, list);
  }

  const clusterLabels: Record<string, { ar: string; en: string }> = {
    participation: { ar: "مشاركة", en: "Participation" },
    equity: { ar: "عدالة", en: "Equity" },
    diversity: { ar: "تنوع", en: "Diversity" },
    expansion: { ar: "توسعة", en: "Expansion" },
    talent: { ar: "مواهب", en: "Talent" },
    representation: { ar: "تمثيل", en: "Representation" },
  };

  const clusters = [...clusterMap.entries()]
    .map(([clusterId, items]) => {
      const maxSeverity = items.reduce<RecommendationSeverity>(
        (best, r) => (severityRank[r.severity] > severityRank[best] ? r.severity : best),
        "info"
      );
      const avgPriority =
        items.reduce((s, r) => s + r.priority, 0) / Math.max(1, items.length);
      const labels = clusterLabels[clusterId] ?? { ar: clusterId, en: clusterId };
      return {
        clusterId,
        labelAr: labels.ar,
        labelEn: labels.en,
        items: sortRecs(items),
        maxSeverity,
        avgPriority,
      };
    })
    .sort((a, b) => b.avgPriority - a.avgPriority);

  return {
    executiveTop3: sorted.slice(0, 3),
    byTier,
    bySeverity,
    clusters,
  };
};
