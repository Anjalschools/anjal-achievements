/**
 * UI-only achievement categories (backward-compatible DB mapping).
 * Stored achievementType/category remain existing enum values; slugs identify rows.
 */

export const UI_CATEGORY_EARLY_UNIVERSITY = "early_university_admission" as const;
export const UI_CATEGORY_ENTREPRENEURSHIP = "entrepreneurship" as const;
export const UI_CATEGORY_TRAINING_COURSES = "training_courses" as const;

export type SpecialUiAchievementCategory =
  | typeof UI_CATEGORY_EARLY_UNIVERSITY
  | typeof UI_CATEGORY_ENTREPRENEURSHIP
  | typeof UI_CATEGORY_TRAINING_COURSES;

export const SPECIAL_UI_CATEGORY_VALUES: ReadonlySet<string> = new Set([
  UI_CATEGORY_EARLY_UNIVERSITY,
  UI_CATEGORY_ENTREPRENEURSHIP,
  UI_CATEGORY_TRAINING_COURSES,
]);

export const isSpecialUiCategory = (ui: string | null | undefined): boolean =>
  SPECIAL_UI_CATEGORY_VALUES.has(String(ui || "").trim());

export const EARLY_UNIVERSITY_OTHER_VALUE = "early_uni_other" as const;

export const EARLY_UNIVERSITY_EVENT_OPTIONS = [
  { value: "uni_kfupm", ar: "جامعة الملك فهد للبترول والمعادن", en: "King Fahd University of Petroleum and Minerals" },
  {
    value: "uni_aramco",
    ar: "Saudi Aramco (برامج التدرج والابتعاث والموهوبين)",
    en: "Saudi Aramco (graduation, scholarship & gifted programs)",
  },
  { value: "uni_ksu", ar: "جامعة الملك سعود", en: "King Saud University" },
  { value: "uni_kaust", ar: "جامعة الملك عبدالله للعلوم والتقنية", en: "KAUST" },
  { value: "uni_pmf", ar: "جامعة الأمير محمد بن فهد", en: "Prince Mohammad Bin Fahd University" },
  { value: "uni_alfaisal", ar: "جامعة الفيصل", en: "Alfaisal University" },
  { value: "uni_mit", ar: "Massachusetts Institute of Technology", en: "Massachusetts Institute of Technology" },
  { value: "uni_stanford", ar: "Stanford University", en: "Stanford University" },
  { value: "uni_harvard", ar: "Harvard University", en: "Harvard University" },
  { value: "uni_cmu", ar: "Carnegie Mellon University", en: "Carnegie Mellon University" },
  { value: "uni_ucb", ar: "University of California, Berkeley", en: "University of California, Berkeley" },
  { value: "uni_gatech", ar: "Georgia Institute of Technology", en: "Georgia Institute of Technology" },
  { value: "uni_toronto", ar: "University of Toronto", en: "University of Toronto" },
  { value: "uni_oxford", ar: "University of Oxford", en: "University of Oxford" },
  { value: "uni_cambridge", ar: "University of Cambridge", en: "University of Cambridge" },
  { value: EARLY_UNIVERSITY_OTHER_VALUE, ar: "أخرى", en: "Other" },
] as const;

export const EARLY_UNIVERSITY_EVENT_VALUES: ReadonlySet<string> = new Set(
  EARLY_UNIVERSITY_EVENT_OPTIONS.map((o) => o.value)
);

/** Saudi / Gulf universities → achievementLevel `kingdom` (المملكة) */
export const SAUDI_ARAB_UNIVERSITY_SLUGS: ReadonlySet<string> = new Set([
  "uni_kfupm",
  "uni_aramco",
  "uni_ksu",
  "uni_kaust",
  "uni_pmf",
  "uni_alfaisal",
]);

/** International universities → achievementLevel `international` (دولي) */
export const INTERNATIONAL_UNIVERSITY_SLUGS: ReadonlySet<string> = new Set([
  "uni_mit",
  "uni_stanford",
  "uni_harvard",
  "uni_cmu",
  "uni_ucb",
  "uni_gatech",
  "uni_toronto",
  "uni_oxford",
  "uni_cambridge",
]);

export const isSaudiArabUniversitySlug = (slug: string): boolean =>
  SAUDI_ARAB_UNIVERSITY_SLUGS.has(String(slug || "").trim());

export const isInternationalUniversitySlug = (slug: string): boolean =>
  INTERNATIONAL_UNIVERSITY_SLUGS.has(String(slug || "").trim());

export const ENTREPRENEURSHIP_EVENT_OPTIONS = [
  { value: "ent_shop", ar: "متجر", en: "Shop" },
  { value: "ent_ecommerce", ar: "متجر إلكتروني", en: "Online store" },
  { value: "ent_home_business", ar: "أسر منتجة", en: "Home-based business" },
  { value: "ent_factory", ar: "مصنع", en: "Factory" },
  { value: "ent_office", ar: "مكتب", en: "Office" },
] as const;

export const ENTREPRENEURSHIP_EVENT_VALUES: ReadonlySet<string> = new Set(
  ENTREPRENEURSHIP_EVENT_OPTIONS.map((o) => o.value)
);

export const TRAINING_MODE_IN_PERSON = "training_in_person" as const;
export const TRAINING_MODE_ONLINE = "training_online" as const;

export const TRAINING_MODE_OPTIONS = [
  { value: TRAINING_MODE_IN_PERSON, ar: "حضوري", en: "In-person" },
  { value: TRAINING_MODE_ONLINE, ar: "أونلاين", en: "Online" },
] as const;

export const TRAINING_MODE_VALUES: ReadonlySet<string> = new Set(
  TRAINING_MODE_OPTIONS.map((o) => o.value)
);

export const getEarlyUniversityEventLabel = (
  value: string,
  locale: "ar" | "en"
): string => {
  const row = EARLY_UNIVERSITY_EVENT_OPTIONS.find((o) => o.value === value);
  if (!row) return value;
  return locale === "ar" ? row.ar : row.en;
};

export const getEntrepreneurshipEventLabel = (
  value: string,
  locale: "ar" | "en"
): string => {
  const row = ENTREPRENEURSHIP_EVENT_OPTIONS.find((o) => o.value === value);
  if (!row) return value;
  return locale === "ar" ? row.ar : row.en;
};
