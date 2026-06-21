import type { StudentSuccessGraphNode } from "@/lib/school-intelligence/school-intelligence-types";

export type SsiPercentileBand =
  | "top_5"
  | "top_10"
  | "top_25"
  | "above_average"
  | "average";

export type StudentPercentileRank = {
  percentile: number;
  band: SsiPercentileBand;
  bandLabelAr: string;
  bandLabelEn: string;
};

const bandFromPercentile = (percentile: number): SsiPercentileBand => {
  if (percentile >= 95) return "top_5";
  if (percentile >= 90) return "top_10";
  if (percentile >= 75) return "top_25";
  if (percentile >= 50) return "above_average";
  return "average";
};

export const ssiBandLabels = (
  band: SsiPercentileBand,
  isAr: boolean
): { ar: string; en: string } => {
  const labels: Record<SsiPercentileBand, { ar: string; en: string }> = {
    top_5: { ar: "أفضل 5%", en: "Top 5%" },
    top_10: { ar: "أفضل 10%", en: "Top 10%" },
    top_25: { ar: "أفضل 25%", en: "Top 25%" },
    above_average: { ar: "فوق المتوسط", en: "Above average" },
    average: { ar: "متوسط", en: "Average" },
  };
  const row = labels[band];
  return isAr ? { ar: row.ar, en: row.en } : row;
};

export const computeStudentPercentileRank = (
  successIndex: number,
  allIndexes: number[]
): StudentPercentileRank => {
  const pool = allIndexes.filter((value) => value > 0);
  if (pool.length === 0 || successIndex <= 0) {
    return {
      percentile: 0,
      band: "average",
      bandLabelAr: "متوسط",
      bandLabelEn: "Average",
    };
  }

  const belowOrEqual = pool.filter((value) => value <= successIndex).length;
  const percentile = Math.round((belowOrEqual / pool.length) * 100);
  const band = bandFromPercentile(percentile);
  const labels = ssiBandLabels(band, true);

  return {
    percentile,
    band,
    bandLabelAr: labels.ar,
    bandLabelEn: labels.en,
  };
};

export const attachStudentPercentileRanks = (
  nodes: StudentSuccessGraphNode[]
): StudentSuccessGraphNode[] => {
  const indexes = nodes.map((node) => node.successIndex);
  return nodes.map((node) => ({
    ...node,
    studentPercentile: computeStudentPercentileRank(node.successIndex, indexes),
  }));
};
