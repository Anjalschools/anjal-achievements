import type { ExecutiveSemanticInsight } from "@/lib/analytics/intelligence/analytics-narrative-schema";

export type StrategicInsightCardType =
  | "opportunity"
  | "warning"
  | "critical"
  | "stability"
  | "growth"
  | "decline"
  | "equity"
  | "recommendation"
  | "exploratory";

export const resolveInsightCardType = (insight: ExecutiveSemanticInsight): StrategicInsightCardType => {
  if (insight.explorationMode || insight.confidence === "EXPLORATORY") return "exploratory";
  if (insight.severity === "CRITICAL") return "critical";
  if (insight.severity === "WARNING") return "warning";
  if (insight.severity === "OPPORTUNITY") return "opportunity";
  if (insight.intelligenceCategory === "Equity") return "equity";
  if (insight.semanticType === "recommendation") return "recommendation";
  if (insight.severity === "SUCCESS") return "growth";
  if (insight.severity === "STABILITY") return "stability";
  if (insight.semanticType === "alert" && insight.impact === "high") return "decline";
  return "recommendation";
};

export const impactScorePercent = (impact: ExecutiveSemanticInsight["impact"]): number => {
  if (impact === "high") return 92;
  if (impact === "medium") return 58;
  return 28;
};
