import { ANJAL_CHART } from "@/lib/anjal-chart-theme";

export const adaptYoYChartData = (rows: Array<{ year: string; participants: number; medals: number; excellence: number }>) =>
  rows.map((r) => ({ ...r }));

export const adaptDemographicChartData = (rows: Array<{ name: string; male: number; female: number }>) =>
  rows.map((r) => ({ ...r }));

export const adaptStageChartData = (rows: Array<{ name: string; n: number }>) => rows.map((r) => ({ ...r }));

export const adaptGenderChartData = (
  rows: Array<{ key: string; name: string; value: number }>
) =>
  rows.map((r) => ({
    ...r,
    fill:
      r.key === "male" ? ANJAL_CHART.male
      : r.key === "female" ? ANJAL_CHART.female
      : ANJAL_CHART.participationBlue,
  }));

export const adaptMawhibaChartData = (
  rows: Array<{ key: string; name: string; value: number }>
) =>
  rows.map((r) => ({
    ...r,
    fill:
      r.key.includes("mawhiba") ? ANJAL_CHART.nominationViolet
      : ANJAL_CHART.silver,
  }));

export const adaptTrendChartData = (rows: Array<{ year: string; aPart: number; bPart: number; aMed: number; bMed: number; aEx: number; bEx: number }>) =>
  rows.map((r) => ({ ...r }));

