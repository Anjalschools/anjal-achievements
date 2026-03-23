/**
 * Unified bilingual labels for achievement types and common DB slugs.
 * Use for dashboard, lists, and anywhere raw keys (nesmo_stage_1, other, …) must not leak to users.
 */

import {
  OLYMPIAD_EVENT_OTHER_VALUE,
  OLYMPIAD_UI_EVENT_OPTIONS,
  QUDRAT_EVENT_OPTIONS,
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
import {
  getDisplayLabel,
  isLikelyTechnicalSlug,
  resolveAchievementEventSlug,
  safeTrim,
} from "@/lib/achievementDisplay";
import type { CertificateUiStatus } from "@/lib/certificate-eligibility";

export type AchievementLabelLocale = "ar" | "en";

const slugKey = (s: string) => safeTrim(s).toLowerCase().replace(/\s+/g, "_");

const mergeOpts = (
  target: Record<string, { ar: string; en: string }>,
  opts: readonly { value: string; ar: string; en: string }[]
) => {
  for (const o of opts) {
    target[slugKey(o.value)] = { ar: o.ar, en: o.en };
  }
};

/** DB `achievementType` values (and close synonyms). */
const ACHIEVEMENT_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  competition: { ar: "مسابقة", en: "Competition" },
  program: { ar: "برنامج", en: "Program" },
  exhibition: { ar: "معرض", en: "Exhibition" },
  olympiad: { ar: "أولمبياد", en: "Olympiad" },
  excellence_program: { ar: "برنامج تميز", en: "Excellence program" },
  qudrat: { ar: "اختبار قدرات", en: "Qudrat test" },
  mawhiba: { ar: "اختبار موهبة السنوي", en: "Mawhiba annual test" },
  mawhiba_annual: { ar: "اختبار موهبة السنوي", en: "Mawhiba annual test" },
  gifted_discovery: { ar: "اكتشاف الموهوبين", en: "Gifted discovery" },
  gifted_screening: { ar: "اختبار الكشف عن الموهوبين", en: "Gifted screening" },
  other: { ar: "إنجاز مسجل", en: "Recorded achievement" },
};

const SLUG_LABELS: Record<string, { ar: string; en: string }> = { ...ACHIEVEMENT_TYPE_LABELS };

mergeOpts(SLUG_LABELS, COMPETITION_OPTIONS);
mergeOpts(SLUG_LABELS, PROGRAM_OPTIONS);
mergeOpts(SLUG_LABELS, EXHIBITION_OPTIONS);
mergeOpts(SLUG_LABELS, OLYMPIAD_MEETINGS);
mergeOpts(SLUG_LABELS, OLYMPIAD_FIELDS);
mergeOpts(SLUG_LABELS, EXCELLENCE_PROGRAM_OPTIONS);
mergeOpts(SLUG_LABELS, QUDRAT_SCORE_OPTIONS);
mergeOpts(SLUG_LABELS, MAWHIBA_ANNUAL_RANKS);
mergeOpts(SLUG_LABELS, MAWHIBA_ANNUAL_SUBJECTS);
SLUG_LABELS.exceptional_gifted = { ar: "موهوب استثنائي", en: "Exceptional gifted" };

for (const o of OLYMPIAD_UI_EVENT_OPTIONS) {
  if (o.value === OLYMPIAD_EVENT_OTHER_VALUE) continue;
  SLUG_LABELS[slugKey(o.value)] = { ar: o.ar, en: o.en };
}
for (const o of QUDRAT_EVENT_OPTIONS) {
  SLUG_LABELS[slugKey(o.value)] = { ar: o.ar, en: o.en };
}

const isLikelyMongoObjectId = (s: string): boolean => /^[a-f0-9]{24}$/i.test(safeTrim(s));

const pick = (m: Record<string, { ar: string; en: string }>, key: string, loc: AchievementLabelLocale) => {
  const row = m[key];
  if (!row) return null;
  return loc === "ar" ? row.ar : row.en;
};

/** Localized label for stored `achievementType`. */
export const getDbAchievementTypeLabel = (
  achievementType: unknown,
  loc: AchievementLabelLocale
): string => {
  const k = slugKey(String(achievementType || ""));
  if (!k) return loc === "ar" ? "غير محدد" : "Not specified";
  return pick(SLUG_LABELS, k, loc) || pick(ACHIEVEMENT_TYPE_LABELS, k, loc) || getDisplayLabel(k, loc);
};

/**
 * Turn a stored slug / raw key into a human label (events, medals, "other", etc.).
 * Never returns raw MongoDB ids.
 */
export const labelAchievementSlugOrKey = (raw: unknown, loc: AchievementLabelLocale): string => {
  const s = safeTrim(raw);
  if (!s) return loc === "ar" ? "غير محدد" : "Not specified";
  if (isLikelyMongoObjectId(s)) return loc === "ar" ? "إنجاز" : "Achievement";
  const k = slugKey(s);
  if (k === "other") return loc === "ar" ? "إنجاز مسجل" : "Recorded achievement";
  const direct = pick(SLUG_LABELS, k, loc);
  if (direct) return direct;
  const resolved = resolveAchievementEventSlug(s);
  if (resolved) return loc === "ar" ? resolved.ar : resolved.en;
  if (!isLikelyTechnicalSlug(s)) return s;
  const gl = getDisplayLabel(s, loc);
  if (gl && gl !== "—" && gl !== s) return gl;
  return loc === "ar" ? "إنجاز مسجل" : "Recorded achievement";
};

/**
 * Subtitle line for dashboard / cards: type + optional event slug, without raw keys.
 */
export const getDashboardAchievementCategoryLine = (
  a: Record<string, unknown>,
  loc: AchievementLabelLocale
): string => {
  const typePart = getDbAchievementTypeLabel(a.achievementType ?? a.achievementCategory, loc);
  const nameCandidates = [
    safeTrim(a.achievementName),
    safeTrim(a.olympiadMeeting),
    safeTrim(a.programName),
    safeTrim(a.competitionName),
  ].filter(Boolean) as string[];

  for (const name of nameCandidates) {
    if (isLikelyMongoObjectId(name)) continue;
    const ev = labelAchievementSlugOrKey(name, loc);
    if (ev && ev !== typePart && slugKey(name) !== slugKey(String(a.achievementType || ""))) {
      return `${typePart} · ${ev}`;
    }
    if (slugKey(name) !== slugKey(String(a.achievementType || "")) && !isLikelyTechnicalSlug(name)) {
      return `${typePart} · ${name}`;
    }
  }

  return typePart;
};

export const labelCertificateUiStatus = (
  status: CertificateUiStatus,
  loc: AchievementLabelLocale
): string => {
  const m: Record<CertificateUiStatus, { ar: string; en: string }> = {
    issued: { ar: "شهادة صادرة", en: "Certificate issued" },
    not_available: { ar: "لا توجد شهادة بعد", en: "No certificate yet" },
    revoked: { ar: "شهادة ملغاة", en: "Certificate revoked" },
  };
  return loc === "ar" ? m[status].ar : m[status].en;
};
