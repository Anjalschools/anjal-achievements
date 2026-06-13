export const PARTNER_ORGANIZATION_CATEGORIES = [
  "health",
  "technology",
  "engineering",
  "university",
  "research",
  "administrative",
  "legal",
  "media",
  "education",
  "entrepreneurship",
  "other",
] as const;

export type PartnerOrganizationCategory = (typeof PARTNER_ORGANIZATION_CATEGORIES)[number];

export const PARTNER_ORGANIZATION_CATEGORY_LABELS: Record<
  PartnerOrganizationCategory,
  { ar: string; en: string }
> = {
  health: { ar: "صحية", en: "Health" },
  technology: { ar: "تقنية", en: "Technology" },
  engineering: { ar: "هندسية", en: "Engineering" },
  university: { ar: "جامعية", en: "University" },
  research: { ar: "بحثية", en: "Research" },
  administrative: { ar: "إدارية", en: "Administrative" },
  legal: { ar: "قانونية", en: "Legal" },
  media: { ar: "إعلامية", en: "Media" },
  education: { ar: "تعليمية", en: "Education" },
  entrepreneurship: { ar: "ريادة أعمال", en: "Entrepreneurship" },
  other: { ar: "أخرى", en: "Other" },
};

export const isValidPartnerOrganizationCategory = (
  value: unknown
): value is PartnerOrganizationCategory =>
  typeof value === "string" &&
  (PARTNER_ORGANIZATION_CATEGORIES as readonly string[]).includes(value);

export const STUDENT_FEEDBACK_RATING_MIN = 1;
export const STUDENT_FEEDBACK_RATING_MAX = 5;
