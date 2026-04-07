/**
 * Tokens that must not appear as the primary achievement title (ranks, medals, result kinds).
 */

const NORM = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");

const RANK_KEYS = new Set([
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "rank_first",
  "rank_second",
  "rank_third",
  "rank_fourth",
  "rank_fifth",
]);

const MEDAL_KEYS = new Set(["gold", "silver", "bronze"]);

const RESULT_KIND_KEYS = new Set([
  "participation",
  "medal",
  "rank",
  "nomination",
  "special_award",
  "recognition",
  "other",
  "score",
  "completion",
  "مشاركة",
  "ميدالية",
  "مركز",
  "ترشيح",
]);

/** Arabic fragments that are rank titles, not event names (avoid as standalone title). */
const AR_RANK_FRAGMENTS = /^(المركز\s*)?(الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)$/;

/**
 * True if this string should not be used as the card/list title when better metadata exists.
 */
export const isDisallowedAchievementTitleToken = (raw: string): boolean => {
  const s = String(raw ?? "").trim();
  if (!s) return false;
  const compactAr = s.replace(/\s+/g, "");
  if (compactAr === "التبرع" || compactAr === "تبرع") return true;
  const k = NORM(s);
  if (RANK_KEYS.has(k) || MEDAL_KEYS.has(k) || RESULT_KIND_KEYS.has(k)) return true;
  if (/^\d+(st|nd|rd|th)$/i.test(s.trim())) return true;
  if (AR_RANK_FRAGMENTS.test(s.replace(/\s+/g, " ").trim())) return true;
  return false;
};
