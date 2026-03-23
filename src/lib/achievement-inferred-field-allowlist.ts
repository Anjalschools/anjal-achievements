/**
 * Allowed `inferredField` values (aligned with achievement-field-inference outputs).
 * Used to clamp AI suggestions and optional student overrides.
 */

export const ALLOWED_INFERRED_FIELD_VALUES: ReadonlySet<string> = new Set([
  "mathematics",
  "physics",
  "chemistry",
  "biology",
  "science",
  "informatics",
  "robotics",
  "stem",
  "arabic_language",
  "sports",
  "scientific_research",
  "space",
  "other",
  "general_talent",
  "technology_innovation",
  "cybersecurity",
  "academic_development",
  "specifications_quality",
  "innovation_inventions",
  "science_engineering",
  "excellence",
  "social_work_excellence",
  "technology",
  "math",
  "arabic",
  "general",
  "cultural",
  "gifted",
]);

export const normalizeInferredFieldCandidate = (raw: unknown): string =>
  String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

/** Map common AI synonyms to platform keys; returns null if unmappable. */
const AI_FIELD_ALIASES: Record<string, string> = {
  gifted: "general_talent",
  cultural: "other",
  technology: "technology_innovation",
  tech: "technology_innovation",
  arabic: "arabic_language",
  math: "mathematics",
  english: "other",
};

export const clampInferredFieldToAllowlist = (raw: unknown): string | null => {
  let k = normalizeInferredFieldCandidate(raw);
  if (!k) return null;
  if (ALLOWED_INFERRED_FIELD_VALUES.has(k)) return k;
  const mapped = AI_FIELD_ALIASES[k];
  if (mapped && ALLOWED_INFERRED_FIELD_VALUES.has(mapped)) return mapped;
  return null;
};

/** Bilingual labels for every allowed inferred-field slug (except `other`, which is never shown as a domain). */
export const INFERRED_FIELD_UI_LABELS: Readonly<
  Record<string, { ar: string; en: string }>
> = {
  mathematics: { ar: "الرياضيات", en: "Mathematics" },
  physics: { ar: "الفيزياء", en: "Physics" },
  chemistry: { ar: "الكيمياء", en: "Chemistry" },
  biology: { ar: "الأحياء", en: "Biology" },
  science: { ar: "العلوم", en: "Science" },
  informatics: { ar: "المعلوماتية", en: "Informatics" },
  robotics: { ar: "الروبوتات", en: "Robotics" },
  stem: { ar: "STEM", en: "STEM" },
  arabic_language: { ar: "اللغة العربية", en: "Arabic language" },
  sports: { ar: "الرياضة", en: "Sports" },
  scientific_research: { ar: "البحث العلمي", en: "Scientific research" },
  space: { ar: "الفضاء", en: "Space" },
  general_talent: { ar: "الموهبة العامة", en: "General talent" },
  technology_innovation: { ar: "التقنية والابتكار", en: "Technology and innovation" },
  cybersecurity: { ar: "الأمن السيبراني", en: "Cybersecurity" },
  academic_development: { ar: "التطوير الأكاديمي", en: "Academic development" },
  specifications_quality: { ar: "المواصفات والجودة", en: "Specifications and quality" },
  innovation_inventions: { ar: "الابتكارات والاختراعات", en: "Innovation and inventions" },
  science_engineering: { ar: "العلوم والهندسة", en: "Science and engineering" },
  excellence: { ar: "التميز", en: "Excellence" },
  social_work_excellence: { ar: "تميز العمل الاجتماعي", en: "Social work excellence" },
  technology: { ar: "التقنية", en: "Technology" },
  math: { ar: "الرياضيات", en: "Mathematics" },
  arabic: { ar: "اللغة العربية", en: "Arabic" },
  general: { ar: "عام", en: "General" },
  cultural: { ar: "الثقافة", en: "Culture" },
  gifted: { ar: "الموهوبين", en: "Gifted education" },
} as const;

/** Human-readable label for a stored inferred-field slug, or `null` if empty, `other`, or unknown. */
export const getInferredFieldUiLabel = (
  slug: string | undefined | null,
  loc: "ar" | "en"
): string | null => {
  const s = normalizeInferredFieldCandidate(slug);
  if (!s || s === "other") return null;
  const row = INFERRED_FIELD_UI_LABELS[s];
  if (!row) return null;
  return loc === "ar" ? row.ar : row.en;
};
