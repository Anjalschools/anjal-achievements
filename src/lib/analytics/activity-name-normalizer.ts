/**
 * Achievement Activity Normalization — maps noisy student titles to canonical analytics keys.
 * Does NOT read description, OCR, nomination text, or AI summaries.
 */

import {
  ACHIEVEMENT_COMPETITION_REGISTRY,
  ACHIEVEMENT_REGISTRY_BY_KEY,
  REGISTRY_ALIAS_INDEX,
  type AchievementCompetitionRegistryEntry,
  type ActivityRegistryCategory,
} from "@/constants/achievement-competition-registry";
import { resolveAchievementEventSlug } from "@/lib/achievementDisplay";

export type ActivityNameInput = {
  achievementType?: string;
  achievementCategory?: string;
  achievementName?: string;
  customAchievementName?: string;
  competitionName?: string;
  customCompetitionName?: string;
  programName?: string;
  customProgramName?: string;
  exhibitionName?: string;
  customExhibitionName?: string;
  olympiadMeeting?: string;
  olympiadField?: string;
  inferredField?: string;
  nameAr?: string;
  nameEn?: string;
  title?: string;
};

export type CanonicalActivityResult = {
  canonicalKey: string;
  displayNameAr: string;
  displayNameEn: string;
  category: ActivityRegistryCategory;
  source: "registry" | "slug" | "custom_normalized";
  registryEntry?: AchievementCompetitionRegistryEntry;
  rawActivityName: string;
};

const MAX_ACTIVITY_NAME_LEN = 120;
const DESCRIPTIVE_NOISE_RE =
  /\b(participated|participation|certificate|شهادة|مشاركة|حصل|حصلت|achieved|award|جائزة)\b/i;

/** Strip punctuation, collapse spaces, lowercase for matching. */
export const normalizeAchievementActivityName = (raw: string): string => {
  let s = String(raw ?? "")
    .trim()
    .replace(/[\u200f\u200e\u061c]/g, "")
    .replace(/[([{][^)\]}]*[)\]}]/g, " ")
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return s;
};

/** Slug-style key for custom (non-registry) activities. */
export const buildCanonicalActivityKey = (raw: string): string => {
  const norm = normalizeAchievementActivityName(raw);
  if (!norm) return "unspecified";
  const slug = norm
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || "unspecified";
};

const safeTrim = (v: unknown): string => String(v ?? "").trim();

/** First meaningful segment when students paste long descriptive text into name fields. */
export const extractAnalyticsActivityDisplayName = (raw: string): string => {
  let s = safeTrim(raw);
  if (!s) return "";
  if (s.length > MAX_ACTIVITY_NAME_LEN) {
    const cut = s.slice(0, MAX_ACTIVITY_NAME_LEN);
    const sep = cut.search(/[،,;|\n]/);
    s = sep > 20 ? cut.slice(0, sep) : cut;
  }
  const lineBreak = s.indexOf("\n");
  if (lineBreak > 0 && lineBreak < 80) s = s.slice(0, lineBreak);
  s = s.replace(/\s+/g, " ").trim();
  if (DESCRIPTIVE_NOISE_RE.test(s) && s.split(/\s+/).length > 6) {
    const first = s.split(/[،,;|]/)[0]?.trim();
    if (first && first.length >= 3 && first.length <= 60) s = first;
  }
  return s;
};

const titleCaseDisplay = (s: string): string => {
  const t = s.trim();
  if (!t) return t;
  if (/[\u0600-\u06FF]/.test(t)) return t;
  return t
    .split(/\s+/)
    .map((w) => {
      if (w.length <= 3 && w === w.toUpperCase()) return w;
      if (/^[A-Z0-9]+$/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
};

/**
 * Pick activity name from achievement fields only — never description / OCR / nomination.
 */
export const pickActivityNameForNormalization = (doc: ActivityNameInput): string => {
  const s = (v: unknown) => safeTrim(v);
  const candidates = [
    s(doc.customAchievementName),
    s(doc.achievementName),
    s(doc.customCompetitionName),
    s(doc.competitionName),
    s(doc.customProgramName),
    s(doc.programName),
    s(doc.customExhibitionName),
    s(doc.exhibitionName),
  ];
  const om = s(doc.olympiadMeeting);
  const of = s(doc.olympiadField);
  if (om && of) candidates.push(`${om} — ${of}`);
  else if (om) candidates.push(om);
  else if (of) candidates.push(of);
  if (s(doc.inferredField)) candidates.push(s(doc.inferredField));
  if (s(doc.nameAr)) candidates.push(s(doc.nameAr));
  if (s(doc.nameEn)) candidates.push(s(doc.nameEn));
  if (s(doc.title)) candidates.push(s(doc.title));

  for (const c of candidates) {
    const cleaned = extractAnalyticsActivityDisplayName(c);
    if (cleaned && cleaned.length >= 2) return cleaned;
  }
  const t = s(doc.achievementType);
  return t || s(doc.achievementCategory) || "";
};

const matchRegistry = (raw: string): AchievementCompetitionRegistryEntry | null => {
  const norm = normalizeAchievementActivityName(raw);
  if (!norm) return null;
  const byAlias = REGISTRY_ALIAS_INDEX.get(norm);
  if (byAlias) return ACHIEVEMENT_REGISTRY_BY_KEY.get(byAlias) ?? null;
  const slugNorm = norm.replace(/\s+/g, "_");
  const bySlug = REGISTRY_ALIAS_INDEX.get(slugNorm);
  if (bySlug) return ACHIEVEMENT_REGISTRY_BY_KEY.get(bySlug) ?? null;
  for (const e of ACHIEVEMENT_COMPETITION_REGISTRY) {
    for (const alias of e.aliases) {
      const aNorm = normalizeAchievementActivityName(alias);
      if (!aNorm) continue;
      if (norm === aNorm || norm.includes(aNorm) || aNorm.includes(norm)) {
        if (Math.min(norm.length, aNorm.length) >= 4 || norm.length === aNorm.length) {
          return e;
        }
      }
    }
  }
  return null;
};

/** Resolve raw / slug / alias input → canonical activity metadata. */
export const resolveCanonicalActivity = (
  input: ActivityNameInput | string
): CanonicalActivityResult => {
  const doc: ActivityNameInput =
    typeof input === "string" ? { achievementName: input } : input;
  const raw = pickActivityNameForNormalization(doc);
  const achievementType = safeTrim(doc.achievementType);

  if (achievementType && REGISTRY_ALIAS_INDEX.has(achievementType.toLowerCase())) {
    const key = REGISTRY_ALIAS_INDEX.get(achievementType.toLowerCase())!;
    const reg = ACHIEVEMENT_REGISTRY_BY_KEY.get(key);
    if (reg) {
      return {
        canonicalKey: reg.canonicalKey,
        displayNameAr: reg.displayNameAr,
        displayNameEn: reg.displayNameEn,
        category: reg.category,
        source: "registry",
        registryEntry: reg,
        rawActivityName: raw || achievementType,
      };
    }
  }

  const slugHit = resolveAchievementEventSlug(raw);
  if (slugHit) {
    const normSlug = normalizeAchievementActivityName(raw).replace(/\s+/g, "_");
    const regKey = REGISTRY_ALIAS_INDEX.get(normSlug);
    const reg = regKey ? ACHIEVEMENT_REGISTRY_BY_KEY.get(regKey) : null;
    if (reg) {
      return {
        canonicalKey: reg.canonicalKey,
        displayNameAr: reg.displayNameAr,
        displayNameEn: reg.displayNameEn,
        category: reg.category,
        source: "slug",
        registryEntry: reg,
        rawActivityName: raw,
      };
    }
    return {
      canonicalKey: buildCanonicalActivityKey(raw),
      displayNameAr: slugHit.ar,
      displayNameEn: slugHit.en,
      category: "other",
      source: "slug",
      rawActivityName: raw,
    };
  }

  const reg = matchRegistry(raw);
  if (reg) {
    return {
      canonicalKey: reg.canonicalKey,
      displayNameAr: reg.displayNameAr,
      displayNameEn: reg.displayNameEn,
      category: reg.category,
      source: "registry",
      registryEntry: reg,
      rawActivityName: raw,
    };
  }

  const key = buildCanonicalActivityKey(raw);
  const display = titleCaseDisplay(raw) || key.replace(/_/g, " ");
  return {
    canonicalKey: key,
    displayNameAr: display,
    displayNameEn: display,
    category: "other",
    source: "custom_normalized",
    rawActivityName: raw,
  };
};

export type GroupedSimilarActivity = {
  canonicalKey: string;
  displayNameAr: string;
  displayNameEn: string;
  category: ActivityRegistryCategory;
  variants: string[];
  count: number;
};

/** Group raw activity strings by resolved canonical key. */
export const groupSimilarActivities = (
  rawNames: string[],
  inputs?: ActivityNameInput[]
): GroupedSimilarActivity[] => {
  const m = new Map<string, GroupedSimilarActivity>();
  rawNames.forEach((name, i) => {
    const resolved = resolveCanonicalActivity(
      inputs?.[i] ?? { achievementName: name }
    );
    const hit =
      m.get(resolved.canonicalKey) ??
      ({
        canonicalKey: resolved.canonicalKey,
        displayNameAr: resolved.displayNameAr,
        displayNameEn: resolved.displayNameEn,
        category: resolved.category,
        variants: [],
        count: 0,
      } satisfies GroupedSimilarActivity);
    hit.count += 1;
    const v = safeTrim(name);
    if (v && !hit.variants.includes(v)) hit.variants.push(v);
    m.set(resolved.canonicalKey, hit);
  });
  return [...m.values()].sort((a, b) => b.count - a.count);
};

export const extractAnalyticsActivityDisplay = (
  input: ActivityNameInput | string,
  loc: "ar" | "en"
): string => {
  const r = resolveCanonicalActivity(input);
  return loc === "ar" ? r.displayNameAr : r.displayNameEn;
};

/** Whether a row matches a filter canonical key (supports legacy display-name filters). */
export const activityMatchesCanonicalFilter = (
  input: ActivityNameInput,
  filterKey: string
): boolean => {
  const f = safeTrim(filterKey);
  if (!f || f === "all") return true;
  const resolved = resolveCanonicalActivity(input);
  if (resolved.canonicalKey === f) return true;
  const normFilter = normalizeAchievementActivityName(f);
  if (normalizeAchievementActivityName(resolved.displayNameAr) === normFilter) return true;
  if (normalizeAchievementActivityName(resolved.displayNameEn) === normFilter) return true;
  if (normalizeAchievementActivityName(resolved.rawActivityName) === normFilter) return true;
  const reg = ACHIEVEMENT_REGISTRY_BY_KEY.get(f);
  if (reg) {
    for (const alias of reg.aliases) {
      if (normalizeAchievementActivityName(alias) === normalizeAchievementActivityName(resolved.rawActivityName)) {
        return true;
      }
    }
  }
  return false;
};
