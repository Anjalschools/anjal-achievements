/**
 * Unified executive narrative / insight schema.
 */

export type InsightSeverity =
  | "INFO"
  | "WARNING"
  | "CRITICAL"
  | "OPPORTUNITY"
  | "SUCCESS"
  | "STABILITY";

export type InsightConfidence = "HIGH" | "MEDIUM" | "LOW" | "EXPLORATORY";

export type IntelligenceCategory =
  | "Risk"
  | "Opportunity"
  | "Expansion"
  | "Equity"
  | "Talent"
  | "Execution"
  | "Participation"
  | "Competition"
  | "Historical";

export type SemanticInsightType =
  | "metric"
  | "trend"
  | "equity"
  | "recommendation"
  | "alert"
  | "exploratory";

export type ExecutiveSemanticInsight = {
  id: string;
  title: string;
  description: string;
  severity: InsightSeverity;
  confidence: InsightConfidence;
  impact: "low" | "medium" | "high";
  evidence: string[];
  recommendation?: string;
  affectedDimensions: string[];
  trendSource?: string;
  metricSource?: string;
  historicalSupport?: boolean;
  generatedBy: string;
  semanticType: SemanticInsightType;
  strategicMeaning: string;
  explorationMode: boolean;
  intelligenceCategory: IntelligenceCategory;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
};

export const createSemanticInsight = (
  partial: Partial<ExecutiveSemanticInsight> & Pick<ExecutiveSemanticInsight, "id" | "titleAr" | "titleEn">
): ExecutiveSemanticInsight => ({
  title: partial.titleAr,
  description: partial.descriptionAr ?? partial.titleAr,
  severity: partial.severity ?? "INFO",
  confidence: partial.confidence ?? "MEDIUM",
  impact: partial.impact ?? "medium",
  evidence: partial.evidence ?? [],
  recommendation: partial.recommendation,
  affectedDimensions: partial.affectedDimensions ?? [],
  trendSource: partial.trendSource,
  metricSource: partial.metricSource,
  historicalSupport: partial.historicalSupport ?? false,
  generatedBy: partial.generatedBy ?? "rule-engine",
  semanticType: partial.semanticType ?? "metric",
  strategicMeaning: partial.strategicMeaning ?? partial.descriptionAr ?? "",
  explorationMode: partial.explorationMode ?? false,
  intelligenceCategory: partial.intelligenceCategory ?? "Execution",
  descriptionAr: partial.descriptionAr ?? partial.titleAr,
  descriptionEn: partial.descriptionEn ?? partial.titleEn,
  ...partial,
});
