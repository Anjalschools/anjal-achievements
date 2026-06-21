export type SchoolIntelligenceConfidenceTier = "high" | "medium" | "low";

export const clampConfidence = (value: number): number =>
  Math.min(100, Math.max(0, Math.round(value)));

export const confidenceTierFromScore = (score: number): SchoolIntelligenceConfidenceTier => {
  if (score >= 85) return "high";
  if (score >= 60) return "medium";
  return "low";
};

export const formatSchoolIntelligenceConfidence = (
  score: number,
  isAr: boolean
): { tier: SchoolIntelligenceConfidenceTier; label: string; score: number } => {
  const normalized = clampConfidence(score);
  const tier = confidenceTierFromScore(normalized);
  const label = isAr
    ? tier === "high"
      ? `ثقة عالية ${normalized}%`
      : tier === "medium"
        ? `ثقة متوسطة ${normalized}%`
        : `ثقة منخفضة ${normalized}%`
    : tier === "high"
      ? `High confidence ${normalized}%`
      : tier === "medium"
        ? `Medium confidence ${normalized}%`
        : `Low confidence ${normalized}%`;

  return { tier, label, score: normalized };
};

export const confidenceFromEvidenceCount = (
  evidenceCount: number,
  sampleSize: number,
  base = 72
): number => {
  const evidenceBoost = Math.min(18, evidenceCount * 4);
  const sampleBoost = sampleSize >= 50 ? 10 : sampleSize >= 15 ? 6 : sampleSize >= 5 ? 3 : 0;
  return clampConfidence(base + evidenceBoost + sampleBoost);
};
