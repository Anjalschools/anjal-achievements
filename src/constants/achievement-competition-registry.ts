/**
 * Canonical competition / activity registry for analytics, reports, and filters.
 * Maps noisy student-entered titles → stable keys with bilingual display names.
 */

import {
  COMPETITION_OPTIONS,
  EXCELLENCE_PROGRAM_OPTIONS,
  EXHIBITION_OPTIONS,
  OLYMPIAD_FIELDS,
  OLYMPIAD_MEETINGS,
  PROGRAM_OPTIONS,
} from "@/constants/achievement-options";

export type ActivityRegistryCategory =
  | "competition"
  | "olympiad"
  | "test"
  | "training"
  | "university_admission"
  | "entrepreneurship"
  | "program"
  | "exhibition"
  | "other";

export type AchievementCompetitionRegistryEntry = {
  canonicalKey: string;
  displayNameAr: string;
  displayNameEn: string;
  aliases: string[];
  category: ActivityRegistryCategory;
  tags?: string[];
  /** Known DB slug values that map to this entry (e.g. achievementName = "bebras"). */
  slugValues?: string[];
};

export const ACTIVITY_REGISTRY_GROUP_LABELS: Record<
  ActivityRegistryCategory,
  { ar: string; en: string }
> = {
  competition: { ar: "مسابقات", en: "Competitions" },
  olympiad: { ar: "أولمبيادات", en: "Olympiads" },
  test: { ar: "اختبارات", en: "Tests" },
  training: { ar: "دورات تدريبية", en: "Training courses" },
  university_admission: { ar: "قبول جامعي", en: "University admission" },
  entrepreneurship: { ar: "ريادة أعمال", en: "Entrepreneurship" },
  program: { ar: "برامج", en: "Programs" },
  exhibition: { ar: "معارض", en: "Exhibitions" },
  other: { ar: "أخرى", en: "Other" },
};

const entry = (
  canonicalKey: string,
  displayNameAr: string,
  displayNameEn: string,
  category: ActivityRegistryCategory,
  aliases: string[] = [],
  tags?: string[],
  slugValues?: string[]
): AchievementCompetitionRegistryEntry => ({
  canonicalKey,
  displayNameAr,
  displayNameEn,
  category,
  tags,
  slugValues: slugValues ?? [canonicalKey],
  aliases: [
    canonicalKey,
    displayNameAr,
    displayNameEn,
    ...aliases,
    ...(slugValues ?? [canonicalKey]),
  ],
});

/** Extra aliases beyond COMPETITION_OPTIONS / PROGRAM_OPTIONS slugs. */
const EXTRA_REGISTRY_ENTRIES: AchievementCompetitionRegistryEntry[] = [
  entry(
    "bebras",
    "بيبراس",
    "Bebras",
    "competition",
    ["بيراس", "بيبرس", "bebras challenge", "bebras saudi", "مسابقة بيبراس"],
    ["computing"]
  ),
  entry(
    "kangaroo",
    "كانجارو",
    "Kangaroo",
    "competition",
    ["kangaroo math", "مسابقة كانجارو", "kangaroo competition", "كانجارو للرياضيات"],
    ["math"]
  ),
  entry(
    "super_speller",
    "Super Speller",
    "Super Speller",
    "competition",
    [
      "super speller",
      "super speller english",
      "spell and write",
      "spell write",
      "spelling bee",
      "قارئ باللغة الإنجليزية",
      "أفضل قارئ باللغة الإنجليزية",
      "english reader",
      "english reading",
    ],
    ["english", "spelling"]
  ),
  entry(
    "stem_racing",
    "STEM Racing",
    "STEM Racing",
    "competition",
    ["stem racing", "stem race", "ستيم ريسينج"],
    ["stem"]
  ),
  entry(
    "timo",
    "TIMO",
    "TIMO",
    "competition",
    ["timo math", "timo olympiad", "تايمو"],
    ["math"]
  ),
  entry(
    "mawhiba",
    "موهوب",
    "Mawhiba",
    "test",
    ["mawhiba", "موهبة", "اختبار موهبة", "mawhiba test", "mawhiba annual"],
    ["gifted"]
  ),
  entry(
    "sat",
    "SAT",
    "SAT",
    "test",
    ["sat test", "اختبار sat", "scholastic aptitude"],
    ["standardized"]
  ),
  entry(
    "ielts",
    "IELTS",
    "IELTS",
    "test",
    ["ielts test", "اختبار ielts"],
    ["standardized"]
  ),
  entry(
    "toefl",
    "TOEFL",
    "TOEFL",
    "test",
    ["toefl test", "اختبار toefl"],
    ["standardized"]
  ),
  entry(
    "qudrat",
    "اختبار القدرات",
    "Qudrat Test",
    "test",
    ["qudrat", "قدرات", "اختبار قدرات"],
    ["standardized"]
  ),
  entry(
    "gifted_discovery",
    "اختبار الكشف عن الموهوبين",
    "Gifted Discovery Test",
    "test",
    ["gifted discovery", "gifted screening", "كشف الموهوبين"],
    ["gifted"]
  ),
  entry(
    "math_olympiad",
    "أولمبياد الرياضيات",
    "Math Olympiad",
    "olympiad",
    ["olympiad mathematics", "math olympiad", "أولمبياد رياضيات", "الرياضيات أولمبياد"],
    ["math"]
  ),
  entry(
    "kfupm_admission",
    "القبول بجامعة الملك فهد",
    "KFUPM Admission",
    "university_admission",
    [
      "kfupm",
      "king fahd university",
      "جامعة الملك فهد",
      "القبول بجامعة الملك فهد للبترول والمعادن",
      "petroleum minerals",
    ],
    ["admission"]
  ),
  entry(
    "kaust",
    "كاوست",
    "KAUST",
    "competition",
    ["kaust math", "kaust", "كاوست للرياضيات", "king abdullah university"],
    ["math", "science"]
  ),
];

const fromOptionList = (
  opts: readonly { value: string; ar: string; en: string }[],
  category: ActivityRegistryCategory
): AchievementCompetitionRegistryEntry[] =>
  opts
    .filter((o) => o.value !== "other")
    .map((o) => entry(o.value, o.ar, o.en, category, [o.ar, o.en], undefined, [o.value]));

const mergeRegistryEntries = (
  lists: AchievementCompetitionRegistryEntry[][]
): AchievementCompetitionRegistryEntry[] => {
  const byKey = new Map<string, AchievementCompetitionRegistryEntry>();
  for (const list of lists) {
    for (const e of list) {
      const hit = byKey.get(e.canonicalKey);
      if (!hit) {
        byKey.set(e.canonicalKey, {
          ...e,
          aliases: [...new Set(e.aliases.map((a) => a.trim()).filter(Boolean))],
          slugValues: [...new Set((e.slugValues ?? [e.canonicalKey]).map((s) => s.trim()))],
        });
        continue;
      }
      hit.aliases = [...new Set([...hit.aliases, ...e.aliases].map((a) => a.trim()).filter(Boolean))];
      hit.slugValues = [
        ...new Set([...(hit.slugValues ?? []), ...(e.slugValues ?? [])].map((s) => s.trim())),
      ];
      if (e.tags?.length) hit.tags = [...new Set([...(hit.tags ?? []), ...e.tags])];
    }
  }
  return [...byKey.values()];
};

export const ACHIEVEMENT_COMPETITION_REGISTRY: AchievementCompetitionRegistryEntry[] =
  mergeRegistryEntries([
    EXTRA_REGISTRY_ENTRIES,
    fromOptionList(COMPETITION_OPTIONS, "competition"),
    fromOptionList(PROGRAM_OPTIONS, "program"),
    fromOptionList(EXHIBITION_OPTIONS, "exhibition"),
    fromOptionList(EXCELLENCE_PROGRAM_OPTIONS, "other"),
    fromOptionList(OLYMPIAD_MEETINGS, "olympiad"),
    fromOptionList(OLYMPIAD_FIELDS, "olympiad"),
  ]);

export const ACHIEVEMENT_REGISTRY_BY_KEY = new Map(
  ACHIEVEMENT_COMPETITION_REGISTRY.map((e) => [e.canonicalKey, e])
);

/** Normalized alias → canonicalKey (built once at module load). */
export const buildRegistryAliasIndex = (): Map<string, string> => {
  const m = new Map<string, string>();
  for (const e of ACHIEVEMENT_COMPETITION_REGISTRY) {
    for (const alias of e.aliases) {
      const norm = alias.trim().toLowerCase().replace(/\s+/g, " ");
      if (norm) m.set(norm, e.canonicalKey);
    }
    for (const slug of e.slugValues ?? []) {
      const norm = slug.trim().toLowerCase().replace(/\s+/g, "_");
      if (norm) m.set(norm, e.canonicalKey);
    }
  }
  return m;
};

export const REGISTRY_ALIAS_INDEX = buildRegistryAliasIndex();
