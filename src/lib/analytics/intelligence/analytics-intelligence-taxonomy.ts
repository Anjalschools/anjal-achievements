import type { IntelligenceCategory, SemanticInsightType } from "@/lib/analytics/intelligence/analytics-narrative-schema";

export const CATEGORY_FROM_NARRATIVE: Record<string, IntelligenceCategory> = {
  executive: "Execution",
  comparative: "Competition",
  trend: "Historical",
  medal: "Competition",
  participation: "Participation",
  section: "Equity",
  opportunity: "Opportunity",
  recommendation: "Execution",
};

export const semanticTypeFromCategory = (cat: string): SemanticInsightType => {
  if (cat === "recommendation") return "recommendation";
  if (cat === "trend") return "trend";
  if (cat === "opportunity") return "equity";
  if (cat === "executive" || cat === "warn") return "alert";
  return "metric";
};
