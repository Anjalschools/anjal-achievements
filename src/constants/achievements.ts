// Achievement Types - Store only values in DB, not labels
export const ACHIEVEMENT_TYPES = [
  { value: "rank", ar: "ترتيب", en: "Rank" },
  { value: "medal", ar: "ميدالية", en: "Medal" },
  { value: "award", ar: "جائزة", en: "Award" },
  { value: "participation", ar: "مشاركة", en: "Participation" },
] as const;

// Achievement Domains/Categories
export const ACHIEVEMENT_DOMAINS = [
  { value: "STEM", ar: "STEM", en: "STEM" },
  { value: "Science", ar: "العلوم", en: "Science" },
  { value: "Math", ar: "الرياضيات", en: "Math" },
  { value: "Technology", ar: "التكنولوجيا", en: "Technology" },
  { value: "Innovation", ar: "الابتكار", en: "Innovation" },
  { value: "Language", ar: "اللغة", en: "Language" },
  { value: "Arts", ar: "الفنون", en: "Arts" },
] as const;

// Achievement Levels
export const ACHIEVEMENT_LEVELS = [
  { value: "school", ar: "مدرسي", en: "School" },
  { value: "regional", ar: "إقليمي", en: "Regional" },
  { value: "national", ar: "وطني", en: "National" },
  { value: "international", ar: "دولي", en: "International" },
] as const;

// Medal Types
export const MEDAL_TYPES = [
  { value: "gold", ar: "ذهبي", en: "Gold" },
  { value: "silver", ar: "فضي", en: "Silver" },
  { value: "bronze", ar: "برونزي", en: "Bronze" },
] as const;

// Achievement Ranks (for rank type achievements)
export const ACHIEVEMENT_RANKS = [
  { value: "first", ar: "المركز الأول", en: "First Place" },
  { value: "second", ar: "المركز الثاني", en: "Second Place" },
  { value: "third", ar: "المركز الثالث", en: "Third Place" },
  { value: "fourth", ar: "المركز الرابع", en: "Fourth Place" },
  { value: "fifth", ar: "المركز الخامس", en: "Fifth Place" },
] as const;

// Competitions - filtered by domain
export const COMPETITIONS = [
  { value: "bebras", label: "Bebras", ar: "ببراس", en: "Bebras", domain: "Technology" },
  { value: "kangaroo", label: "Kangaroo", ar: "كنغارو", en: "Kangaroo", domain: "Math" },
  { value: "nasmo", label: "NASMO", ar: "ناسمو", en: "NASMO", domain: "Math" },
  { value: "isef", label: "ISEF", ar: "آيسف", en: "ISEF", domain: "Science" },
  { value: "olympiad", label: "Olympiad", ar: "الأولمبياد", en: "Olympiad", domain: "STEM" },
  { value: "robotics", label: "Robotics", ar: "الروبوتيك", en: "Robotics", domain: "Technology" },
  { value: "programming", label: "Programming", ar: "البرمجة", en: "Programming", domain: "Technology" },
] as const;

/**
 * Get label for achievement type by locale
 */
export function getAchievementTypeLabel(
  value: string,
  locale: "ar" | "en"
): string {
  const type = ACHIEVEMENT_TYPES.find((t) => t.value === value);
  return type ? (locale === "ar" ? type.ar : type.en) : value;
}

/**
 * Get label for domain by locale
 */
export function getDomainLabel(value: string, locale: "ar" | "en"): string {
  const domain = ACHIEVEMENT_DOMAINS.find((d) => d.value === value);
  return domain ? (locale === "ar" ? domain.ar : domain.en) : value;
}

/**
 * Get label for level by locale
 */
export function getLevelLabel(value: string, locale: "ar" | "en"): string {
  const level = ACHIEVEMENT_LEVELS.find((l) => l.value === value);
  return level ? (locale === "ar" ? level.ar : level.en) : value;
}

/**
 * Get competitions filtered by domain
 */
type CompetitionItem = (typeof COMPETITIONS)[number];

export function getCompetitionsByDomain(domain: string): CompetitionItem[] {
  return COMPETITIONS.filter((c) => c.domain === domain);
}
