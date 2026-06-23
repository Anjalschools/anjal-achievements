const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const round1 = (value: number) => Math.round(value * 10) / 10;

export type YearlyMetricPoint = {
  year: string;
  value: number;
};

export type LongitudinalGrowthSeries = {
  achievementGrowth: YearlyMetricPoint[];
  trainingGrowth: YearlyMetricPoint[];
  talentGrowth: YearlyMetricPoint[];
  careerReadinessGrowth: YearlyMetricPoint[];
  overallTrend: "rising" | "stable" | "emerging";
};

export type LongitudinalGrowthInput = {
  achievementByYear: Record<string, number>;
  trainingHoursByYear: Record<string, number>;
  talentScoreByYear: Record<string, number>;
  careerReadinessByYear: Record<string, number>;
};

const toSeries = (map: Record<string, number>): YearlyMetricPoint[] =>
  Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, value]) => ({ year, value: round1(value) }));

const trendFromSeries = (series: YearlyMetricPoint[]): "rising" | "stable" | "emerging" => {
  if (series.length < 2) return "emerging";
  const first = series[0]?.value ?? 0;
  const last = series.at(-1)?.value ?? 0;
  if (last - first >= 8) return "rising";
  if (Math.abs(last - first) <= 5) return "stable";
  return "emerging";
};

export const buildLongitudinalGrowthSeries = (
  input: LongitudinalGrowthInput
): LongitudinalGrowthSeries => {
  const achievementGrowth = toSeries(input.achievementByYear);
  const trainingGrowth = toSeries(input.trainingHoursByYear);
  const talentGrowth = toSeries(input.talentScoreByYear);
  const careerReadinessGrowth = toSeries(input.careerReadinessByYear);

  const combined = [
    ...achievementGrowth.map((row) => row.value),
    ...talentGrowth.map((row) => row.value),
    ...careerReadinessGrowth.map((row) => row.value),
  ];
  const avgDelta =
    combined.length >= 2 ? clamp(combined.at(-1)! - combined[0]!) : 0;

  const overallTrend =
    avgDelta >= 8 ? "rising" : avgDelta <= 2 && combined.length >= 2 ? "stable" : "emerging";

  return {
    achievementGrowth,
    trainingGrowth,
    talentGrowth,
    careerReadinessGrowth,
    overallTrend,
  };
};
