import type { InsightConfidence } from "@/lib/analytics/intelligence/analytics-narrative-schema";

export const confidenceFromNumeric = (
  score: number,
  exploratoryMode = false
): InsightConfidence => {
  if (exploratoryMode) return "EXPLORATORY";
  if (score >= 0.75) return "HIGH";
  if (score >= 0.45) return "MEDIUM";
  return "LOW";
};

export const confidenceFromSignal = (input: {
  hasParticipation: boolean;
  hasOutcome: boolean;
  yearSpan: number;
  sparse?: boolean;
  exploratory?: boolean;
}): InsightConfidence => {
  if (input.exploratory || input.sparse) return "EXPLORATORY";
  if (!input.hasParticipation) return "LOW";
  if (input.hasOutcome && input.yearSpan >= 2) return "HIGH";
  if (input.hasOutcome) return "MEDIUM";
  return "LOW";
};

export const confidenceLabel = (c: InsightConfidence, isAr: boolean): string => {
  const map: Record<InsightConfidence, { ar: string; en: string }> = {
    HIGH: { ar: "ثقة عالية", en: "High confidence" },
    MEDIUM: { ar: "ثقة متوسطة", en: "Medium confidence" },
    LOW: { ar: "ثقة منخفضة", en: "Low confidence" },
    EXPLORATORY: { ar: "إشارة استكشافية", en: "Exploratory signal" },
  };
  return isAr ? map[c].ar : map[c].en;
};
