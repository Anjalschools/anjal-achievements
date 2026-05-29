/**
 * benchmark-engine.ts
 * Cross-year and inter-school benchmarking.
 */
import type { InstitutionalSnapshot, YearOverYearMetrics } from "./executive-insight-types";

export type BenchmarkSummary = {
  bestYear: number;
  worstYear: number;
  bestYearParticipations: number;
  worstYearParticipations: number;
  totalGrowthPct: number;
  avgYearlyGrowthPct: number;
  participationCagr: number;
  awardDensityTrend: "rising" | "falling" | "stable";
};

export const computeBenchmarkSummary = (
  snapshot: InstitutionalSnapshot
): BenchmarkSummary => {
  const yoy = [...snapshot.yearOverYear].sort((a, b) => a.year - b.year);
  if (yoy.length < 2) {
    const single = yoy[0];
    return {
      bestYear: single?.year ?? 0,
      worstYear: single?.year ?? 0,
      bestYearParticipations: single?.totalParticipations ?? 0,
      worstYearParticipations: single?.totalParticipations ?? 0,
      totalGrowthPct: 0,
      avgYearlyGrowthPct: 0,
      participationCagr: 0,
      awardDensityTrend: "stable",
    };
  }

  const best  = yoy.reduce((a, b) => b.totalParticipations > a.totalParticipations ? b : a);
  const worst = yoy.reduce((a, b) => b.totalParticipations < a.totalParticipations ? b : a);

  const first = yoy[0]!;
  const last  = yoy[yoy.length - 1]!;
  const years = last.year - first.year;
  const totalGrowthPct =
    first.totalParticipations > 0
      ? Math.round(((last.totalParticipations - first.totalParticipations) / first.totalParticipations) * 100)
      : 0;
  const avgYearlyGrowthPct = years > 0 ? Math.round(totalGrowthPct / years) : 0;
  const participationCagr =
    years > 0 && first.totalParticipations > 0
      ? Math.round(((last.totalParticipations / first.totalParticipations) ** (1 / years) - 1) * 1000) / 10
      : 0;

  // award density trend
  const densities = yoy.map((y) =>
    y.totalParticipations > 0 ? y.totalAwards / y.totalParticipations : 0
  );
  const firstDens = densities.slice(0, Math.ceil(densities.length / 2));
  const lastDens  = densities.slice(Math.ceil(densities.length / 2));
  const avgFirst  = firstDens.reduce((s, d) => s + d, 0) / (firstDens.length || 1);
  const avgLast   = lastDens.reduce((s, d) => s + d, 0)  / (lastDens.length || 1);
  const awardDensityTrend: BenchmarkSummary["awardDensityTrend"] =
    avgLast > avgFirst * 1.05 ? "rising"
    : avgLast < avgFirst * 0.95 ? "falling"
    : "stable";

  return {
    bestYear: best.year,
    worstYear: worst.year,
    bestYearParticipations: best.totalParticipations,
    worstYearParticipations: worst.totalParticipations,
    totalGrowthPct,
    avgYearlyGrowthPct,
    participationCagr,
    awardDensityTrend,
  };
};
