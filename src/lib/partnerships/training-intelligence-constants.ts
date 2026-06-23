export const TRAINING_NARRATIVE_SIMILARITY_THRESHOLD = 75;

export const TRAINING_CONSISTENCY_LOW_THRESHOLD = 60;

export const TRAINING_RATING_MISMATCH_DELTA = 2;

export const TRAINING_HOURS_MIN = 15;
export const TRAINING_HOURS_MAX = 360;
export const TRAINING_HOURS_MISMATCH_TOLERANCE_PCT = 20;

export const TRAINING_INTELLIGENCE_RISK_FLAGS = [
  "LOW_CONSISTENCY",
  "HOURS_MISMATCH",
  "RATING_MISMATCH",
  "HIGH_TEXT_SIMILARITY",
  "UNUSUAL_HOURS",
  "INSTITUTION_STUDENT_MISMATCH",
] as const;

export type TrainingIntelligenceRiskFlag = (typeof TRAINING_INTELLIGENCE_RISK_FLAGS)[number];

export const TRAINING_QUALITY_INDEX_BANDS = [
  { min: 85, ar: "ممتاز", en: "Excellent" },
  { min: 70, ar: "جيد", en: "Good" },
  { min: 55, ar: "مقبول", en: "Acceptable" },
  { min: 0, ar: "يحتاج تحسين", en: "Needs Improvement" },
] as const;

export const trainingQualityLabelForScore = (score: number, isAr: boolean): string => {
  const band =
    TRAINING_QUALITY_INDEX_BANDS.find((row) => score >= row.min) ||
    TRAINING_QUALITY_INDEX_BANDS[TRAINING_QUALITY_INDEX_BANDS.length - 1];
  return isAr ? band.ar : band.en;
};

export const TRAINING_INTELLIGENCE_RISK_LABELS: Record<
  TrainingIntelligenceRiskFlag,
  { ar: string; en: string }
> = {
  LOW_CONSISTENCY: { ar: "اتساق منخفض بين تقرير الطالب والمؤسسة", en: "Low student–institution consistency" },
  HOURS_MISMATCH: { ar: "تعارض في ساعات التدريب", en: "Training hours mismatch" },
  RATING_MISMATCH: { ar: "تعارض في التقييمات", en: "Rating mismatch" },
  HIGH_TEXT_SIMILARITY: { ar: "تشابه نصي مرتفع بين التقريرين", en: "High narrative similarity" },
  UNUSUAL_HOURS: { ar: "ساعات تدريب غير اعتيادية", en: "Unusual training hours" },
  INSTITUTION_STUDENT_MISMATCH: { ar: "عدم تطابق بين تقرير الطالب والمؤسسة", en: "Institution–student report mismatch" },
};
