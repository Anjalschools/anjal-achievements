/** Shared types for admin advanced analytics — safe for client import. */

export type AdvancedLabeledRow = {
  key: string;
  labelAr: string;
  labelEn: string;
  count: number;
  pct: number;
};

export type AdminInsightItem = {
  type: string;
  titleAr: string;
  descriptionAr: string;
  priority: "low" | "medium" | "high";
  confidence?: number;
  category: string;
  relatedAchievementIds?: string[];
  relatedStudentIds?: string[];
  createdAt: string;
};

/** Rule-based operational recommendations (not LLM) — Arabic + English for UI parity. */
export type AnalyticsRecommendationCategory =
  | "competition"
  | "program"
  | "pathway"
  | "timing"
  | "quality"
  | "diversity"
  | "strategy";

export type AdminAnalyticsRecommendation = {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  priority: "high" | "medium" | "low";
  category: AnalyticsRecommendationCategory;
  relatedMetricKey?: string;
  nextStepAr?: string;
  nextStepEn?: string;
  relatedLabelsAr?: string[];
};
