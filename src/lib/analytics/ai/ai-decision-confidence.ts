import type { AiDecisionConfidence } from "@/lib/analytics/ai/ai-decision-schema";

export const confidenceFromNumeric = (
  score: number,
  exploratoryMode?: boolean
): AiDecisionConfidence => {
  if (exploratoryMode) return "EXPLORATORY";
  if (score >= 0.78) return "HIGH";
  if (score >= 0.52) return "MEDIUM";
  return "LOW";
};

export const confidenceRank = (c: AiDecisionConfidence): number => {
  if (c === "HIGH") return 3;
  if (c === "MEDIUM") return 2;
  if (c === "LOW") return 1;
  return 0;
};

export const confidenceLabel = (c: AiDecisionConfidence, isAr: boolean): string => {
  if (c === "HIGH") return isAr ? "ثقة عالية" : "High confidence";
  if (c === "MEDIUM") return isAr ? "ثقة متوسطة" : "Medium confidence";
  if (c === "LOW") return isAr ? "ثقة منخفضة" : "Low confidence";
  return isAr ? "استكشافي" : "Exploratory";
};

export const downgradedWording = (confidence: AiDecisionConfidence): boolean =>
  confidence === "LOW" || confidence === "EXPLORATORY";
