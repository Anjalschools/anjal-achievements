export const QUALITY_SCORE_BANDS = [
  { min: 92, ar: "ممتاز", en: "Excellent" },
  { min: 81, ar: "جيد جداً", en: "Very good" },
  { min: 70, ar: "جيد", en: "Good" },
  { min: 0, ar: "يحتاج تحسين", en: "Needs improvement" },
] as const;

export const PARTNERSHIP_ALERT_TYPES = [
  "no_response",
  "missing_reports",
  "rating_drop",
  "exemplary",
] as const;

export type PartnershipAlertType = (typeof PARTNERSHIP_ALERT_TYPES)[number];

export const PARTNERSHIP_ALERT_LABELS: Record<
  PartnershipAlertType,
  { ar: string; en: string }
> = {
  no_response: { ar: "مؤسسة لم ترد خلال المدة المحددة", en: "Institution did not respond in time" },
  missing_reports: { ar: "مؤسسة لم ترفع تقارير نهائية", en: "Institution missing final reports" },
  rating_drop: { ar: "انخفاض تقييم المؤسسة", en: "Institution rating declined" },
  exemplary: { ar: "مؤسسة متميزة", en: "Exemplary institution" },
};

export const SUPERVISOR_FEEDBACK_DIMENSIONS = [
  "cooperation",
  "commitment",
  "responseSpeed",
  "reportQuality",
  "communication",
] as const;

export type SupervisorFeedbackDimension = (typeof SUPERVISOR_FEEDBACK_DIMENSIONS)[number];

export const SUPERVISOR_FEEDBACK_LABELS: Record<
  SupervisorFeedbackDimension,
  { ar: string; en: string }
> = {
  cooperation: { ar: "التعاون", en: "Cooperation" },
  commitment: { ar: "الالتزام", en: "Commitment" },
  responseSpeed: { ar: "سرعة الاستجابة", en: "Response speed" },
  reportQuality: { ar: "جودة التقارير", en: "Report quality" },
  communication: { ar: "سهولة التواصل", en: "Communication ease" },
};

export const ANNUAL_REVIEW_RENEWAL_DECISIONS = [
  "renew",
  "renew_with_conditions",
  "review_next_year",
  "do_not_renew",
] as const;

export type AnnualReviewRenewalDecision = (typeof ANNUAL_REVIEW_RENEWAL_DECISIONS)[number];

export const ANNUAL_REVIEW_RENEWAL_LABELS: Record<
  AnnualReviewRenewalDecision,
  { ar: string; en: string }
> = {
  renew: { ar: "تجديد الشراكة", en: "Renew partnership" },
  renew_with_conditions: { ar: "تجديد بشروط", en: "Renew with conditions" },
  review_next_year: { ar: "مراجعة العام القادم", en: "Review next year" },
  do_not_renew: { ar: "عدم التجديد", en: "Do not renew" },
};

export const PARTNERSHIP_INTELLIGENCE_RANKING_KEYS = [
  "topRated",
  "mostActive",
  "highestAcceptance",
  "highestRated",
  "fastestResponse",
] as const;

export type PartnershipRankingKey = (typeof PARTNERSHIP_INTELLIGENCE_RANKING_KEYS)[number];

export const DEFAULT_NO_RESPONSE_ALERT_DAYS = 7;

export const qualityLabelForScore = (score: number, isAr: boolean): string => {
  const band = QUALITY_SCORE_BANDS.find((b) => score >= b.min) || QUALITY_SCORE_BANDS[QUALITY_SCORE_BANDS.length - 1];
  return isAr ? band.ar : band.en;
};
