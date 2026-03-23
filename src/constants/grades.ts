export const GRADE_OPTIONS = [
  { value: "g1", ar: "الأول الابتدائي", en: "First Primary" },
  { value: "g2", ar: "الثاني الابتدائي", en: "Second Primary" },
  { value: "g3", ar: "الثالث الابتدائي", en: "Third Primary" },
  { value: "g4", ar: "الرابع الابتدائي", en: "Fourth Primary" },
  { value: "g5", ar: "الخامس الابتدائي", en: "Fifth Primary" },
  { value: "g6", ar: "السادس الابتدائي", en: "Sixth Primary" },
  { value: "g7", ar: "الأول المتوسط", en: "First Intermediate" },
  { value: "g8", ar: "الثاني المتوسط", en: "Second Intermediate" },
  { value: "g9", ar: "الثالث المتوسط", en: "Third Intermediate" },
  { value: "g10", ar: "الأول الثانوي", en: "First Secondary" },
  { value: "g11", ar: "الثاني الثانوي", en: "Second Secondary" },
  { value: "g12", ar: "الثالث الثانوي", en: "Third Secondary" },
];

/**
 * Normalize grade value to standard format (g1-g12)
 * Handles both old numeric format (1-12) and new format (g1-g12)
 */
export function normalizeGrade(value: string | number | null | undefined): string | null {
  if (!value) return null;

  const str = String(value).trim();

  // Already in new format
  if (str.startsWith("g")) {
    return str;
  }

  // Convert numeric to new format
  const num = parseInt(str, 10);
  if (num >= 1 && num <= 12) {
    return `g${num}`;
  }

  // Return as-is if can't normalize
  return str;
}

/**
 * Get human-readable grade label by locale
 */
export function getGradeLabel(value: string | number | null | undefined, locale: "ar" | "en"): string {
  const normalized = normalizeGrade(value);
  
  if (!normalized) {
    return locale === "ar" ? "غير محدد" : "Not specified";
  }

  const grade = GRADE_OPTIONS.find((g) => g.value === normalized);

  if (!grade) {
    return String(value);
  }

  return locale === "ar" ? grade.ar : grade.en;
}
