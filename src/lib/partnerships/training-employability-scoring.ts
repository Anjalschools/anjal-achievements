import { EMPLOYABILITY_BAND_LABELS } from "@/lib/partnerships/training-outcome-constants";

export type EmployabilityScoreInput = {
  /** Overall institution evaluation average (1–5 scale). */
  institutionEvaluationAverage?: number;
  attendanceScore: number;
  professionalismScore: number;
  communicationScore: number;
  teamworkScore: number;
  initiativeScore: number;
  workQualityScore: number;
  safetyComplianceScore: number;
};

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(n)));

/** Convert 1–5 rubric score to 0–100. */
const scale1to5 = (score: number): number => clamp(((score - 1) / 4) * 100);

const avg = (values: number[]): number =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

/**
 * Deterministic employability score (0–100) from institution evaluation dimensions.
 * Does not modify Career Engine.
 */
export const computeEmployabilityScore = (input: EmployabilityScoreInput): number => {
  const dimensionScores = [
    input.attendanceScore,
    input.professionalismScore,
    input.communicationScore,
    input.teamworkScore,
    input.initiativeScore,
    input.workQualityScore,
    input.safetyComplianceScore,
  ].filter((n) => n > 0);

  const scaledDimensions = dimensionScores.map(scale1to5);
  const dimensionAvg = avg(scaledDimensions);

  const institutionAvg =
    input.institutionEvaluationAverage != null && input.institutionEvaluationAverage > 0
      ? scale1to5(input.institutionEvaluationAverage)
      : dimensionAvg;

  return clamp(institutionAvg * 0.35 + dimensionAvg * 0.65);
};

export const computeInstitutionEvaluationScore = (scores: number[]): number => {
  const valid = scores.filter((n) => n > 0);
  if (!valid.length) return 0;
  return clamp(avg(valid.map(scale1to5)));
};

export type EmployabilityBand = keyof typeof EMPLOYABILITY_BAND_LABELS;

export const employabilityBandForScore = (score: number): EmployabilityBand => {
  if (score >= 90) return "excellent";
  if (score >= 80) return "veryGood";
  if (score >= 70) return "good";
  if (score >= 60) return "acceptable";
  return "needsDevelopment";
};

export const employabilityBandLabel = (
  score: number,
  locale: "ar" | "en" = "ar"
): { band: EmployabilityBand; label: string; score: number } => {
  const band = employabilityBandForScore(score);
  const row = EMPLOYABILITY_BAND_LABELS[band];
  return { band, label: locale === "ar" ? row.ar : row.en, score };
};
