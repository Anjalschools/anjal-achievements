export const TALENT_AREAS = [
  {
    key: "technical",
    ar: "تقني",
    en: "Technical",
    signals: ["technology", "programming", "digital", "software", "robot", "تقن", "برمج", "حاسب", "robotics"],
  },
  {
    key: "research",
    ar: "بحثي",
    en: "Research",
    signals: ["research", "science", "olympiad", "mawhiba", "بحث", "علم", "أولمبياد", "موهبة"],
  },
  {
    key: "leadership",
    ar: "قيادي",
    en: "Leadership",
    signals: ["leadership", "president", "captain", "initiative", "قياد", "رئيس", "قائد", "مبادرة"],
  },
  {
    key: "health",
    ar: "صحي",
    en: "Health",
    signals: ["health", "medical", "medicine", "clinic", "صح", "طب", "تمريض"],
  },
  {
    key: "engineering",
    ar: "هندسي",
    en: "Engineering",
    signals: ["engineering", "math", "physics", "mechanical", "هندس", "رياض", "فيزي"],
  },
  {
    key: "entrepreneurial",
    ar: "ريادي",
    en: "Entrepreneurial",
    signals: ["entrepreneur", "business", "startup", "marketing", "رياد", "أعمال", "تسويق"],
  },
  {
    key: "creative",
    ar: "إبداعي",
    en: "Creative",
    signals: ["art", "design", "media", "writing", "music", "إبداع", "فن", "تصميم", "إعلام"],
  },
] as const;

export type TalentAreaKey = (typeof TALENT_AREAS)[number]["key"];

export const CAREER_READINESS_INDEX_BANDS = [
  { min: 85, key: "distinguished", ar: "متميز", en: "Distinguished" },
  { min: 70, key: "advanced", ar: "متقدم", en: "Advanced" },
  { min: 50, key: "developing", ar: "نامٍ", en: "Developing" },
  { min: 0, key: "needs_support", ar: "بحاجة دعم", en: "Needs support" },
] as const;

export type CareerReadinessIndexBandKey = (typeof CAREER_READINESS_INDEX_BANDS)[number]["key"];

export const talentAreaLabel = (key: TalentAreaKey, isAr: boolean) => {
  const row = TALENT_AREAS.find((item) => item.key === key);
  return row ? (isAr ? row.ar : row.en) : key;
};

export const careerReadinessIndexBandForScore = (score: number): CareerReadinessIndexBandKey => {
  const band = CAREER_READINESS_INDEX_BANDS.find((item) => score >= item.min);
  return band?.key || "needs_support";
};

export const careerReadinessIndexLabel = (key: CareerReadinessIndexBandKey, isAr: boolean) => {
  const row = CAREER_READINESS_INDEX_BANDS.find((item) => item.key === key);
  return row ? (isAr ? row.ar : row.en) : key;
};
