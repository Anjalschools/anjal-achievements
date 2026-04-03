import type { ApprovalStatusNormalized } from "@/lib/achievementNormalize";
import {
  isArabicText,
  displayNameForLocale,
  normalizeAchievementNames,
} from "@/lib/achievementNormalize";
import {
  OLYMPIAD_EVENT_OTHER_VALUE,
  OLYMPIAD_UI_EVENT_OPTIONS,
} from "@/constants/achievement-ui-categories";
import {
  COMPETITION_OPTIONS,
  EXCELLENCE_PROGRAM_OPTIONS,
  EXHIBITION_OPTIONS,
  MAWHIBA_ANNUAL_RANKS,
  MAWHIBA_ANNUAL_SUBJECTS,
  OLYMPIAD_FIELDS,
  OLYMPIAD_MEETINGS,
  PROGRAM_OPTIONS,
  QUDRAT_SCORE_OPTIONS,
} from "@/constants/achievement-options";
import { getInferredFieldUiLabel } from "@/lib/achievement-inferred-field-allowlist";

type Loc = "ar" | "en";

/** Safe string for display — never assumes .trim() on arbitrary input. */
export const safeString = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
};

export const safeTrim = (value: unknown): string => safeString(value).trim();

const mergeSlugLabels = (
  target: Record<string, { ar: string; en: string }>,
  opts: readonly { value: string; ar: string; en: string }[]
) => {
  for (const o of opts) {
    const k = o.value.toLowerCase().replace(/\s+/g, "_");
    target[k] = { ar: o.ar, en: o.en };
  }
};

/** Maps internal achievementName/value slugs → bilingual labels (competitions, programs, etc.) */
const ACHIEVEMENT_NAME_BY_SLUG: Record<string, { ar: string; en: string }> = {};
mergeSlugLabels(ACHIEVEMENT_NAME_BY_SLUG, COMPETITION_OPTIONS);
mergeSlugLabels(ACHIEVEMENT_NAME_BY_SLUG, PROGRAM_OPTIONS);
mergeSlugLabels(ACHIEVEMENT_NAME_BY_SLUG, EXHIBITION_OPTIONS);
mergeSlugLabels(ACHIEVEMENT_NAME_BY_SLUG, OLYMPIAD_MEETINGS);
mergeSlugLabels(ACHIEVEMENT_NAME_BY_SLUG, EXCELLENCE_PROGRAM_OPTIONS);
mergeSlugLabels(ACHIEVEMENT_NAME_BY_SLUG, OLYMPIAD_FIELDS);
mergeSlugLabels(ACHIEVEMENT_NAME_BY_SLUG, QUDRAT_SCORE_OPTIONS);
mergeSlugLabels(ACHIEVEMENT_NAME_BY_SLUG, MAWHIBA_ANNUAL_RANKS);
mergeSlugLabels(ACHIEVEMENT_NAME_BY_SLUG, MAWHIBA_ANNUAL_SUBJECTS);
ACHIEVEMENT_NAME_BY_SLUG.exceptional_gifted = { ar: "موهوب استثنائي", en: "Exceptional Gifted" };
mergeSlugLabels(
  ACHIEVEMENT_NAME_BY_SLUG,
  OLYMPIAD_UI_EVENT_OPTIONS.filter((o) => o.value !== OLYMPIAD_EVENT_OTHER_VALUE)
);

export const resolveAchievementEventSlug = (slug: unknown) => {
  if (slug === undefined || slug === null) return null;
  const k = safeTrim(slug).toLowerCase().replace(/\s+/g, "_");
  if (!k) return null;
  const hit = ACHIEVEMENT_NAME_BY_SLUG[k];
  if (hit) return hit;
  if (/^nesmo_stage_\d+$/.test(k)) {
    return { ar: "فعالية نسمو", en: "Nesmo Activity" };
  }
  return null;
};

/** Latin slug / internal key (no Arabic letters). */
export const isLikelyTechnicalSlug = (s: unknown): boolean => {
  const t = safeTrim(s);
  if (!t) return false;
  if (isArabicText(t)) return false;
  return /^[a-z0-9_]+$/.test(t);
};

export type AchievementCardNameInput = {
  /** Explicit Arabic display title (highest priority when present). */
  titleAr?: string;
  nameAr?: string;
  nameEn?: string;
  title?: string;
  achievementName?: string;
  customAchievementName?: string;
};

/** Plain numeric/string score from DB — no recalculation. */
const formatAchievementScoreValue = (value: unknown): string => {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.round(value));
  if (typeof value === "string" && String(value).trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return String(Math.round(n));
  }
  return "—";
};

/**
 * Points label for UI: pass a number, or an object with `.score` (e.g. achievement row).
 */
export const getAchievementScoreDisplay = (input: unknown, _loc?: Loc): string => {
  void _loc;
  if (input !== null && typeof input === "object" && "score" in input) {
    return formatAchievementScoreValue((input as { score?: unknown }).score);
  }
  return formatAchievementScoreValue(input);
};

/** Preferred entry for cards/lists: titleAr → nameAr → slug map → fallback chain. */
export const getAchievementDisplayName = (a: Record<string, unknown>, loc: Loc): string =>
  getAchievementCardDisplayName(
    {
      titleAr: safeTrim(a.titleAr) || undefined,
      nameAr: safeTrim(a.nameAr) || undefined,
      nameEn: safeTrim(a.nameEn) || undefined,
      title: safeTrim(a.title) || undefined,
      achievementName: safeTrim(a.achievementName) || undefined,
      customAchievementName: safeTrim(a.customAchievementName) || undefined,
    },
    loc
  );

/** Card title: Arabic-friendly names, resolves slugs via constants, last resort is normalized display chain. */
export const getAchievementCardDisplayName = (raw: AchievementCardNameInput, loc: Loc): string => {
  const custom = safeTrim(raw.customAchievementName);
  if (custom && !isLikelyTechnicalSlug(custom)) {
    return custom;
  }

  const trySlug = (v: unknown): string | null => {
    const s = safeTrim(v);
    if (!s || !isLikelyTechnicalSlug(s)) return null;
    const hit = resolveAchievementEventSlug(s);
    if (!hit) return null;
    return loc === "ar" ? hit.ar : hit.en;
  };

  if (loc === "ar") {
    const titleAr = safeTrim(raw.titleAr);
    if (titleAr && isArabicText(titleAr)) return titleAr;
    const nar = safeTrim(raw.nameAr);
    if (nar && isArabicText(nar)) return nar;
    const fromSlug =
      trySlug(raw.achievementName) ||
      trySlug(raw.nameAr) ||
      trySlug(raw.nameEn) ||
      trySlug(raw.title);
    if (fromSlug) return fromSlug;
  } else {
    const nen = safeTrim(raw.nameEn);
    if (nen && !isLikelyTechnicalSlug(nen)) return nen;
    const fromSlug =
      trySlug(raw.achievementName) ||
      trySlug(raw.nameEn) ||
      trySlug(raw.nameAr) ||
      trySlug(raw.title);
    if (fromSlug) return fromSlug;
  }

  const gl = getDisplayLabel(
    safeTrim(raw.achievementName) ||
      safeTrim(raw.title) ||
      safeTrim(raw.nameAr) ||
      safeTrim(raw.nameEn) ||
      undefined,
    loc
  );
  if (gl && gl !== "—") return gl;

  const names = normalizeAchievementNames({
    nameAr: raw.nameAr,
    nameEn: raw.nameEn,
    title: raw.title,
    achievementName: raw.achievementName,
    customAchievementName: raw.customAchievementName,
  } as Record<string, unknown>);
  const fromNorm = displayNameForLocale(names, loc);
  const cleaned = safeTrim(fromNorm);
  if (cleaned) return cleaned;
  return loc === "ar" ? "إنجاز بدون عنوان" : "Untitled achievement";
};

const pick = (m: Record<string, { ar: string; en: string }>, key: unknown, loc: Loc) => {
  const keyStr = safeTrim(key);
  const k = keyStr.toLowerCase().replace(/\s+/g, "_");
  if (m[k]) return loc === "ar" ? m[k].ar : m[k].en;
  const alt = keyStr.toLowerCase();
  for (const [x, v] of Object.entries(m)) if (alt === x || alt.includes(x)) return loc === "ar" ? v.ar : v.en;
  return keyStr || "—";
};


const UI_CAT: Record<string, { ar: string; en: string }> = {
  olympiad: { ar: "أولمبياد", en: "Olympiad" },
  excellence_program: { ar: "برنامج تميز", en: "Excellence program" },
  qudrat: { ar: "اختبار قدرات", en: "Qudrat test" },
  mawhiba: { ar: "اختبار موهبة السنوي", en: "Mawhiba annual test" },
  mawhiba_annual: { ar: "اختبار موهبة السنوي", en: "Mawhiba annual test" },
  gifted_screening: { ar: "اختبار الكشف عن الموهوبين", en: "Gifted screening" },
  other: { ar: "أخرى", en: "Other" },
};
const EVENT_LABELS: Record<string, { ar: string; en: string }> = {
  bebras: { ar: "بيبراس", en: "Bebras" },
  kangaroo: { ar: "كانجارو", en: "Kangaroo" },
  informatics: { ar: "المعلوماتية", en: "Informatics" },
  mathematics: { ar: "الرياضيات", en: "Mathematics" },
  math: { ar: "الرياضيات", en: "Mathematics" },
};

const CAT: Record<string, { ar: string; en: string }> = {
  competition: { ar: "مسابقة", en: "Competition" },
  program: { ar: "برنامج", en: "Program" },
  exhibition: { ar: "معرض", en: "Exhibition" },
  standardized_tests: { ar: "الاختبارات المعيارية", en: "Standardized tests" },
};

const CLASS: Record<string, { ar: string; en: string }> = {
  academic: { ar: "أكاديمي", en: "Academic" },
  technical: { ar: "تقني", en: "Technical" },
  cultural: { ar: "ثقافي", en: "Cultural" },
  research: { ar: "بحثي", en: "Research" },
  volunteer: { ar: "تطوعي", en: "Volunteer" },
  qudurat: { ar: "القدرات", en: "Qudrat" },
  gifted_screening: { ar: "اختبار الكشف عن الموهوبين", en: "Gifted screening" },
  gifted_discovery: { ar: "اكتشاف الموهوبين", en: "Gifted discovery" },
  mawhiba_annual: { ar: "اختبار موهبة السنوي", en: "Mawhiba annual" },
  other: { ar: "أخرى", en: "Other" },
};

const LEVEL: Record<string, { ar: string; en: string }> = {
  school: { ar: "المدرسة", en: "School" },
  province: { ar: "المحافظة", en: "Province" },
  governorate: { ar: "المحافظة", en: "Governorate" },
  district: { ar: "الإدارة / المنطقة", en: "District" },
  regional: { ar: "المنطقة", en: "Regional" },
  local: { ar: "محلي", en: "Local" },
  admin: { ar: "الإدارة التعليمية", en: "Education office" },
  administration: { ar: "الإدارة التعليمية", en: "Administration" },
  local_authority: { ar: "الجهة المحلية", en: "Local authority" },
  kingdom: { ar: "المملكة", en: "Kingdom" },
  international: { ar: "دولي", en: "International" },
  global: { ar: "العالم", en: "Global" },
  world: { ar: "العالم", en: "World" },
  national: { ar: "المملكة", en: "National" },
};

const RESULT_TYPE: Record<string, { ar: string; en: string }> = {
  participation: { ar: "مشاركة", en: "Participation" },
  medal: { ar: "ميدالية", en: "Medal" },
  rank: { ar: "مركز", en: "Rank" },
  nomination: { ar: "ترشيح", en: "Nomination" },
  special_award: { ar: "جائزة خاصة", en: "Special award" },
  recognition: { ar: "تكريم", en: "Recognition" },
  other: { ar: "أخرى", en: "Other" },
  score: { ar: "درجة", en: "Score" },
  completion: { ar: "إكمال", en: "Completion" },
};

const MEDAL: Record<string, { ar: string; en: string }> = {
  gold: { ar: "ذهبية", en: "Gold" },
  silver: { ar: "فضية", en: "Silver" },
  bronze: { ar: "برونزية", en: "Bronze" },
};

const RANK: Record<string, { ar: string; en: string }> = {
  first: { ar: "المركز الأول", en: "First place" },
  second: { ar: "المركز الثاني", en: "Second place" },
  third: { ar: "المركز الثالث", en: "Third place" },
  fourth: { ar: "المركز الرابع", en: "Fourth place" },
  fifth: { ar: "المركز الخامس", en: "Fifth place" },
  rank_first: { ar: "المركز الأول", en: "First place" },
  rank_second: { ar: "المركز الثاني", en: "Second place" },
  rank_third: { ar: "المركز الثالث", en: "Third place" },
};

const FIELD: Record<string, { ar: string; en: string }> = {
  informatics: { ar: "المعلوماتية", en: "Informatics" },
  science: { ar: "العلوم", en: "Science" },
  technology: { ar: "التقنية", en: "Technology" },
  math: { ar: "الرياضيات", en: "Mathematics" },
  arabic: { ar: "اللغة العربية", en: "Arabic" },
  general: { ar: "عام", en: "General" },
};

const LEGACY_TYPE: Record<string, { ar: string; en: string }> = {
  competition: { ar: "مسابقة", en: "Competition" },
  program: { ar: "برنامج", en: "Program" },
  exhibition: { ar: "معرض", en: "Exhibition" },
  olympiad: { ar: "أولمبياد", en: "Olympiad" },
  excellence_program: { ar: "برنامج تميز", en: "Excellence program" },
  qudrat: { ar: "القدرات", en: "Qudrat" },
  mawhiba_annual: { ar: "موهبة السنوي", en: "Mawhiba annual" },
  gifted_discovery: { ar: "اكتشاف الموهوبين", en: "Gifted discovery" },
  sat: { ar: "اختبار SAT", en: "SAT" },
  ielts: { ar: "اختبار IELTS", en: "IELTS" },
  toefl: { ar: "اختبار TOEFL", en: "TOEFL" },
  other: { ar: "أخرى", en: "Other" },
};

export const labelAchievementCategory = (v: string | undefined, loc: Loc) => pick(CAT, v, loc);
export const labelAchievementClassification = (v: string | undefined, loc: Loc) => pick(CLASS, v, loc);
export const labelAchievementLevel = (v: string | undefined, loc: Loc) => pick(LEVEL, v, loc);

/** Level → localized label (school / province / kingdom / international, + legacy synonyms). */
export const getAchievementLevelLabel = (level: unknown, loc: Loc): string => {
  const raw = safeTrim(level);
  if (!raw) return loc === "ar" ? "غير محدد" : "—";
  return labelAchievementLevel(raw, loc);
};

export const labelResultType = (v: string | undefined, loc: Loc) => pick(RESULT_TYPE, v, loc);
export const labelMedal = (v: string | undefined, loc: Loc) => pick(MEDAL, v, loc);
export const labelRank = (v: string | undefined, loc: Loc) => pick(RANK, v, loc);
export const labelInferredField = (v: string | undefined, loc: Loc) => {
  const fromAllowlist = getInferredFieldUiLabel(v, loc);
  if (fromAllowlist) return fromAllowlist;
  const k = safeTrim(v).toLowerCase().replace(/\s+/g, "_");
  if (!k || k === "other") return loc === "ar" ? "غير محدد" : "Not specified";
  return pick(FIELD, v, loc);
};
export const labelLegacyAchievementType = (v: string | undefined, loc: Loc) => pick(LEGACY_TYPE, v, loc);

export const labelApprovalStatus = (s: ApprovalStatusNormalized, loc: Loc) => {
  const m: Record<ApprovalStatusNormalized, { ar: string; en: string }> = {
    pending: { ar: "في انتظار الموافقة", en: "Pending approval" },
    needs_revision: { ar: "يحتاج تعديل", en: "Needs revision" },
    approved: { ar: "تمت الموافقة", en: "Approved" },
    featured: { ar: "إنجاز مميز", en: "Featured" },
    pending_re_review: { ar: "بانتظار إعادة المراجعة", en: "Pending re-review" },
    rejected: { ar: "مرفوض", en: "Rejected" },
    unreviewed: { ar: "غير مفحوص", en: "Unreviewed" },
  };
  return loc === "ar" ? m[s].ar : m[s].en;
};

export const formatLocalizedResultLine = (
  resultType: string | undefined,
  medalType: string | undefined,
  rank: string | undefined,
  loc: Loc,
  scoreValue?: number | string
): string => {
  const rt = String(resultType || "");
  if (rt === "medal") {
    const m = labelMedal(medalType, loc);
    return loc === "ar" ? `ميدالية ${m}` : `${m} medal`;
  }
  if (rt === "rank") return labelRank(rank, loc);
  if (rt === "participation") return labelResultType("participation", loc);
  if (rt === "score") {
    const base = labelResultType("score", loc);
    if (typeof scoreValue === "number" && !Number.isNaN(scoreValue)) {
      return loc === "ar" ? `${base}: ${scoreValue}` : `${base}: ${scoreValue}`;
    }
    if (typeof scoreValue === "string" && scoreValue.trim()) {
      const t = scoreValue.trim();
      return loc === "ar" ? `${base}: ${t}` : `${base}: ${t}`;
    }
    return base;
  }
  if (rt === "completion") return labelResultType("completion", loc);
  return labelResultType(rt, loc);
};

export const labelEvidenceMode = (mode: string | undefined, loc: Loc) =>
  mode === "skipped"
    ? loc === "ar"
      ? "تم تجاوز الإثبات"
      : "Evidence skipped"
    : loc === "ar"
      ? "تم تقديم إثبات"
      : "Evidence provided";

export const labelVerificationStatus = (v: string | undefined, loc: Loc) => {
  const m: Record<string, { ar: string; en: string }> = {
    unverified: { ar: "غير مفحوص", en: "Unverified" },
    pending_committee_review: { ar: "بانتظار مراجعة اللجنة", en: "Pending committee review" },
    verified: { ar: "مُفحوص", en: "Verified" },
    mismatch: { ar: "عدم تطابق", en: "Mismatch" },
  };
  return pick(m, v, loc);
};

/** Unified display label: categories, levels, medals, legacy types, common event keys. */
export const getDisplayLabel = (value: unknown, locale: Loc): string => {
  const raw = safeTrim(value);
  if (!raw) {
    return locale === "ar" ? "—" : "—";
  }
  const k = raw.toLowerCase().replace(/\s+/g, "_");
  const merged: Record<string, { ar: string; en: string }> = {
    ...CAT,
    ...UI_CAT,
    ...CLASS,
    ...LEVEL,
    ...RESULT_TYPE,
    ...MEDAL,
    ...RANK,
    ...FIELD,
    ...LEGACY_TYPE,
    ...EVENT_LABELS,
    ...ACHIEVEMENT_NAME_BY_SLUG,
  };
  if (merged[k]) return locale === "ar" ? merged[k].ar : merged[k].en;
  for (const [x, v] of Object.entries(merged)) {
    if (raw.toLowerCase() === x || raw.toLowerCase().includes(x)) {
      return locale === "ar" ? v.ar : v.en;
    }
  }
  return raw;
};
