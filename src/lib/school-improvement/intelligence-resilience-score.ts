import type { IntelligenceRecoveryStatsSummary } from "@/lib/school-improvement/intelligence-diagnostics-types";

export const calculateResilienceScore = (stats: IntelligenceRecoveryStatsSummary): {
  score: number;
  labelAr: string;
  labelEn: string;
} => {
  const retryWeight = stats.total > 0 ? (stats.retrySuccess / Math.max(stats.total, 1)) * 30 : 30;
  const snapshotWeight = stats.total > 0 ? (stats.snapshotFallback / Math.max(stats.total, 1)) * 25 : 25;
  const queryWeight = stats.total > 0 ? (stats.queryDegraded / Math.max(stats.total, 1)) * 15 : 15;
  const envWeight = stats.environmentRecovered > 0 ? 10 : stats.total === 0 ? 10 : 5;
  const baseRecovery = (stats.recoveryRatePct / 100) * 20;
  const failurePenalty = stats.failed * 2;
  const score = Math.max(0, Math.min(100, Math.round(retryWeight + snapshotWeight + queryWeight + envWeight + baseRecovery - failurePenalty)));

  if (score >= 90) return { score, labelAr: "مرونة عالية", labelEn: "High resilience" };
  if (score >= 75) return { score, labelAr: "مرونة جيدة", labelEn: "Good resilience" };
  if (score >= 60) return { score, labelAr: "مرونة متوسطة", labelEn: "Moderate resilience" };
  return { score, labelAr: "مرونة منخفضة", labelEn: "Low resilience" };
};
