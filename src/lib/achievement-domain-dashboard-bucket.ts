/**
 * Maps stored achievement "field" data (مجال) into dashboard chart buckets
 * used by `domainKeyLabel` (scientific, technical, cultural, sports, quran, arts, other).
 *
 * Priority for raw values (string from DB or aggregation _id):
 * 1) normalized slug via `inferredField` allowlist (includes legacy `domain` when it matches)
 * 2) heuristics on olympiad / free-text (e.g. quran, arts)
 * 3) other
 */

import {
  clampInferredFieldToAllowlist,
  normalizeInferredFieldCandidate,
} from "@/lib/achievement-inferred-field-allowlist";
import { labelInferredField } from "@/lib/achievementDisplay";

export type DashboardDomainBucket =
  | "scientific"
  | "technical"
  | "cultural"
  | "sports"
  | "quran"
  | "arts"
  | "other";

const SLUG_TO_BUCKET: Record<string, DashboardDomainBucket> = {
  mathematics: "scientific",
  math: "scientific",
  physics: "scientific",
  chemistry: "scientific",
  biology: "scientific",
  science: "scientific",
  scientific_research: "scientific",
  space: "scientific",
  stem: "scientific",
  gifted: "scientific",
  academic_development: "scientific",

  informatics: "technical",
  robotics: "technical",
  technology_innovation: "technical",
  cybersecurity: "technical",
  technology: "technical",
  innovation_inventions: "technical",
  science_engineering: "technical",
  specifications_quality: "technical",

  arabic_language: "cultural",
  arabic: "cultural",
  cultural: "cultural",
  social_work_excellence: "cultural",

  sports: "sports",

  general_talent: "other",
  excellence: "other",
  general: "other",
  other: "other",
};

const QURAN_RX = /quran|قرآن|قران|tajweed|تجويد/i;
const ARTS_RX = /(^|[^a-z])art([^a-z]|$)|فن|موسيق|music|theater|مسرح|رسم|draw/i;

/** First non-empty trimmed string from a record — matches API coalescing order. */
export const normalizeAchievementFieldRaw = (record: {
  inferredField?: unknown;
  domain?: unknown;
  olympiadField?: unknown;
}): string => {
  const a = String(record.inferredField ?? "").trim();
  if (a) return a;
  const b = String(record.domain ?? "").trim();
  if (b) return b;
  return String(record.olympiadField ?? "").trim();
};

export const normalizeAchievementFieldValue = (raw: unknown): string =>
  normalizeInferredFieldCandidate(raw);

/** Bilingual display label for the coalesced field on a document (UI). */
export const getAchievementFieldLabel = (
  record: { inferredField?: unknown; domain?: unknown; olympiadField?: unknown },
  loc: "ar" | "en"
): string => {
  const coalesced = normalizeAchievementFieldRaw(record);
  return labelInferredField(coalesced || undefined, loc);
};

export const normalizeAchievementFieldToDashboardBucket = (raw: unknown): DashboardDomainBucket => {
  const s0 = String(raw ?? "").trim();
  if (!s0) return "other";

  const normalized = normalizeInferredFieldCandidate(s0);
  const clamped =
    clampInferredFieldToAllowlist(normalized) ||
    clampInferredFieldToAllowlist(s0) ||
    clampInferredFieldToAllowlist(s0.replace(/-/g, "_"));

  if (clamped) {
    return SLUG_TO_BUCKET[clamped] ?? "other";
  }

  if (QURAN_RX.test(s0) || QURAN_RX.test(normalized)) return "quran";
  if (ARTS_RX.test(s0) || ARTS_RX.test(normalized)) return "arts";

  return "other";
};
