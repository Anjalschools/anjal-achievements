export const TRAINING_OUTCOME_LEVELS = [
  { min: 90, key: "exceptional", ar: "استثنائي", en: "Exceptional" },
  { min: 75, key: "high", ar: "مرتفع", en: "High" },
  { min: 60, key: "good", ar: "جيد", en: "Good" },
  { min: 45, key: "moderate", ar: "متوسط", en: "Moderate" },
  { min: 0, key: "low", ar: "منخفض", en: "Low" },
] as const;

export type TrainingOutcomeLevelKey = (typeof TRAINING_OUTCOME_LEVELS)[number]["key"];

export const PARTNERSHIP_EARLY_RISK_FLAGS = [
  "LOW_SUCCESS_RISK",
  "LOW_ENGAGEMENT_RISK",
  "DOCUMENT_COMPLETION_RISK",
] as const;

export type PartnershipEarlyRiskFlag = (typeof PARTNERSHIP_EARLY_RISK_FLAGS)[number];

export const PARTNERSHIP_CATEGORY_RANKING_GROUPS = {
  government: {
    labelAr: "أفضل الجهات الحكومية",
    labelEn: "Best government partners",
    categories: ["administrative", "legal"] as const,
    sectorHints: ["حكوم", "government", "وزارة", "أمانة", "بلدية"],
  },
  education: {
    labelAr: "أفضل الجهات التعليمية",
    labelEn: "Best education partners",
    categories: ["education", "university", "research"] as const,
    sectorHints: ["تعليم", "education", "جامعة", "مدرس"],
  },
  health: {
    labelAr: "أفضل الجهات الصحية",
    labelEn: "Best health partners",
    categories: ["health"] as const,
    sectorHints: ["صح", "health", "مستشف", "clinic"],
  },
  technology: {
    labelAr: "أفضل الجهات التقنية",
    labelEn: "Best technology partners",
    categories: ["technology", "engineering"] as const,
    sectorHints: ["تقن", "tech", "software", "digital"],
  },
  volunteer: {
    labelAr: "أفضل الجهات التطوعية",
    labelEn: "Best volunteer partners",
    categories: ["other", "entrepreneurship"] as const,
    sectorHints: ["تطوع", "volunteer", "nonprofit", "جمعية"],
  },
} as const;

export type PartnershipCategoryRankingGroupKey = keyof typeof PARTNERSHIP_CATEGORY_RANKING_GROUPS;

export const trainingOutcomeLabel = (key: TrainingOutcomeLevelKey, isAr: boolean) => {
  const row = TRAINING_OUTCOME_LEVELS.find((item) => item.key === key);
  return row ? (isAr ? row.ar : row.en) : key;
};

export const trainingOutcomeLevelForScore = (score: number): TrainingOutcomeLevelKey => {
  const band = TRAINING_OUTCOME_LEVELS.find((item) => score >= item.min);
  return band?.key || "low";
};
