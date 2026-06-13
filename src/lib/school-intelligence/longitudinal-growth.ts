import "server-only";
import { buildInstitutionalSnapshot } from "@/lib/analytics/institutional-snapshot-builder";
import type { LongitudinalGrowthPoint, StudentSuccessGraphNode } from "@/lib/school-intelligence/school-intelligence-types";

const clamp = (n: number) => Math.round(n * 10) / 10;

export const buildLongitudinalGrowth = async (
  nodes: StudentSuccessGraphNode[]
): Promise<LongitudinalGrowthPoint[]> => {
  const snapshot = await buildInstitutionalSnapshot();
  const avgSuccessIndex =
    nodes.length > 0 ? nodes.reduce((s, n) => s + n.successIndex, 0) / nodes.length : 0;

  const points: LongitudinalGrowthPoint[] = snapshot.yearOverYear.map((row, idx, arr) => {
    const prev = idx > 0 ? arr[idx - 1] : null;
    const growthRatePct =
      prev && prev.totalParticipations > 0
        ? clamp(((row.totalParticipations - prev.totalParticipations) / prev.totalParticipations) * 100)
        : 0;
    return {
      year: row.year,
      participations: row.totalParticipations,
      students: row.totalAwards,
      avgSuccessIndex: Math.round(avgSuccessIndex),
      growthRatePct,
    };
  });

  if (points.length === 0) {
    const year = new Date().getFullYear();
    points.push({
      year,
      participations: nodes.reduce((s, n) => s + n.participationCount, 0),
      students: nodes.filter((n) => n.participationCount > 0).length,
      avgSuccessIndex: Math.round(avgSuccessIndex),
      growthRatePct: 0,
    });
  }

  return points;
};

export const computeYearOverYearGrowthPct = (points: LongitudinalGrowthPoint[]): number => {
  if (points.length < 2) return 0;
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  if (prev.participations <= 0) return 0;
  return clamp(((last.participations - prev.participations) / prev.participations) * 100);
};
