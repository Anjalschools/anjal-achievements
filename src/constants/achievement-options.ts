/**
 * Achievement Options Constants
 * All achievement-related dropdown options and lists
 */

// Achievement Types
export const ACHIEVEMENT_TYPES = [
  { value: "competition", ar: "مسابقة", en: "Competition" },
  { value: "program", ar: "برنامج", en: "Program" },
  { value: "exhibition", ar: "معرض", en: "Exhibition" },
  { value: "olympiad", ar: "أولمبياد", en: "Olympiad" },
  { value: "excellence_program", ar: "برنامج تميز", en: "Excellence Program" },
  { value: "qudrat", ar: "اختبار القدرات", en: "Qudrat Test" },
  { value: "mawhiba_annual", ar: "اختبار موهبة السنوي", en: "Mawhiba Annual Test" },
  { value: "gifted_discovery", ar: "اختبار الكشف عن الموهوبين", en: "Gifted Discovery Test" },
  { value: "sat", ar: "اختبار SAT", en: "SAT" },
  { value: "ielts", ar: "اختبار IELTS", en: "IELTS" },
  { value: "toefl", ar: "اختبار TOEFL", en: "TOEFL" },
  { value: "other", ar: "إنجاز آخر", en: "Other Achievement" },
] as const;

// Achievement Levels
export const ACHIEVEMENT_LEVELS = [
  { value: "school", ar: "المدرسة", en: "School" },
  { value: "province", ar: "المحافظة", en: "Province" },
  { value: "kingdom", ar: "المملكة", en: "Kingdom" },
  { value: "international", ar: "عالمي", en: "International" },
] as const;

// Participation Types
export const PARTICIPATION_TYPES = [
  { value: "individual", ar: "فردي", en: "Individual" },
  { value: "team", ar: "جماعي", en: "Team" },
] as const;

// Achievement Result Types
export const ACHIEVEMENT_RESULT_TYPES = [
  { value: "participation", ar: "مشاركة", en: "Participation" },
  { value: "medal", ar: "ميدالية", en: "Medal" },
  { value: "rank", ar: "مركز", en: "Rank" },
  { value: "nomination", ar: "ترشيح", en: "Nomination" },
  { value: "special_award", ar: "جائزة خاصة", en: "Special Award" },
  { value: "recognition", ar: "تكريم", en: "Recognition" },
  { value: "other", ar: "أخرى", en: "Other" },
] as const;

// Medal Types
export const MEDAL_TYPES = [
  { value: "gold", ar: "ذهبية", en: "Gold" },
  { value: "silver", ar: "فضية", en: "Silver" },
  { value: "bronze", ar: "برونزية", en: "Bronze" },
] as const;

// Rank Options
export const RANK_OPTIONS = [
  { value: "first", ar: "الأول", en: "First" },
  { value: "second", ar: "الثاني", en: "Second" },
  { value: "third", ar: "الثالث", en: "Third" },
  { value: "fourth", ar: "الرابع", en: "Fourth" },
  { value: "fifth", ar: "الخامس", en: "Fifth" },
  { value: "sixth", ar: "السادس", en: "Sixth" },
  { value: "seventh", ar: "السابع", en: "Seventh" },
  { value: "eighth", ar: "الثامن", en: "Eighth" },
  { value: "ninth", ar: "التاسع", en: "Ninth" },
  { value: "tenth", ar: "العاشر", en: "Tenth" },
] as const;

// Competition Options
export const COMPETITION_OPTIONS = [
  { value: "bebras", ar: "بيبراس", en: "Bebras" },
  { value: "kangaroo", ar: "كانجارو", en: "Kangaroo" },
  { value: "kaust_math", ar: "كاوست للرياضيات", en: "KAUST Math" },
  { value: "smart_city_hackathon", ar: "هاكاثون المدينة الذكية", en: "Smart City Hackathon" },
  { value: "cyber_pioneers_hackathon", ar: "هاكاثون رواد الأمن السيبراني", en: "Cyber Pioneers Hackathon" },
  { value: "wro", ar: "مسابقة الروبوت العالمية (WRO)", en: "World Robot Olympiad (WRO)" },
  { value: "arabic_reading", ar: "تحدي القراءة العربي", en: "Arabic Reading Challenge" },
  { value: "f1_schools", ar: "فورملا 1 في المدارس", en: "Formula 1 in Schools" },
  { value: "swimming", ar: "السباحة", en: "Swimming" },
  { value: "karate", ar: "الكاراتيه", en: "Karate" },
  { value: "football", ar: "كرة القدم", en: "Football" },
  { value: "volleyball", ar: "كرة الطائرة", en: "Volleyball" },
  { value: "badminton", ar: "البادل", en: "Badminton" },
  { value: "other", ar: "آخر", en: "Other" },
] as const;

// Program Options
export const PROGRAM_OPTIONS = [
  { value: "misk_university_prep", ar: "مسك للإعداد الجامعي", en: "Misk University Prep" },
  { value: "steps", ar: "برنامج الإعداد الجامعي STEPS", en: "STEPS University Prep Program" },
  { value: "srsi", ar: "برنامج العلوم البحثية (SRSI)", en: "Scientific Research Summer Institute (SRSI)" },
  { value: "space_2101", ar: "معسكر الفضاء (Space 2101)", en: "Space Camp (Space 2101)" },
  { value: "research_pathway", ar: "برامج المسار البحثي", en: "Research Pathway Programs" },
  { value: "olympiad_specs", ar: "الأولمبياد الدولي للمواصفات", en: "International Olympiad of Specifications" },
  {
    value: "social_volunteer_programs",
    ar: "برامج الخدمة الاجتماعية والتطوع",
    en: "Social service and volunteering programs",
  },
  { value: "other", ar: "آخر", en: "Other" },
] as const;

// Exhibition Options
export const EXHIBITION_OPTIONS = [
  { value: "taiwan_tisef", ar: "تايسف - تايوان", en: "TISEF - Taiwan" },
  { value: "croatia_anova", ar: "آنوفا للاختراعات والابتكارات - كرواتيا", en: "ANOVA - Croatia" },
  { value: "malaysia_itex", ar: "آيتكس - ماليزيا", en: "ITEX - Malaysia" },
  { value: "us_isef", ar: "معرض آيسف - الولايات المتحدة الأمريكية", en: "ISEF - USA" },
  { value: "ibdaa", ar: "معرض إبداع للعلوم والهندسة", en: "Ibdaa Science and Engineering Fair" },
  { value: "central_exhibition", ar: "المعرض المركزي", en: "Central Exhibition" },
  { value: "other", ar: "آخر", en: "Other" },
] as const;

// Olympiad Meetings
export const OLYMPIAD_MEETINGS = [
  { value: "winter", ar: "ملتقى الشتاء", en: "Winter Meeting" },
  { value: "spring", ar: "ملتقى الربيع", en: "Spring Meeting" },
  { value: "summer", ar: "ملتقى الصيف", en: "Summer Meeting" },
  { value: "elite", ar: "ملتقى النخبة", en: "Elite Meeting" },
] as const;

// Olympiad Fields
export const OLYMPIAD_FIELDS = [
  { value: "mathematics", ar: "الرياضيات", en: "Mathematics" },
  { value: "physics", ar: "الفيزياء", en: "Physics" },
  { value: "chemistry", ar: "الكيمياء", en: "Chemistry" },
  { value: "biology", ar: "الأحياء", en: "Biology" },
  { value: "science", ar: "العلوم", en: "Science" },
  { value: "informatics", ar: "المعلوماتية", en: "Informatics" },
] as const;

// Excellence Program Options
export const EXCELLENCE_PROGRAM_OPTIONS = [
  { value: "sheikh_abdulwahab_mousa", ar: "جائزة الشيخ عبدالوهاب الموسى للتميز التعليمي", en: "Sheikh Abdulwahab Mousa Excellence Award" },
  { value: "hamdan_bin_rashid", ar: "جائزة حمدان بن راشد آل مكتوم - فئة الطالب المتميز", en: "Hamdan Bin Rashid Al Maktoum Award - Distinguished Student" },
  { value: "princess_seeta", ar: "جائزة الأميرة صيتة بنت عبدالعزيز للتميز في العمل الاجتماعي", en: "Princess Seeta Bint Abdulaziz Excellence in Social Work Award" },
  { value: "other", ar: "آخر", en: "Other" },
] as const;

/** Qudrat tiers stored as `achievementName` (e.g. qudrat_99). Includes legacy 98–100 + 95–97. */
export const QUDRAT_TIER_ALLOWED_VALUES = [
  "qudrat_95",
  "qudrat_96",
  "qudrat_97",
  "qudrat_98",
  "qudrat_99",
  "qudrat_100",
] as const;

export const QUDRAT_TIER_OPTIONS = QUDRAT_TIER_ALLOWED_VALUES.map((value) => {
  const n = value.replace("qudrat_", "");
  return { value, ar: `${n}٪`, en: `${n}%` };
});

/** @deprecated Prefer QUDRAT_TIER_OPTIONS — kept for any external references */
export const QUDRAT_SCORE_OPTIONS = [
  { value: "100", ar: "100%", en: "100%" },
  { value: "99", ar: "99%", en: "99%" },
  { value: "98", ar: "98%", en: "98%" },
] as const;

// Mawhiba Annual Ranks
export const MAWHIBA_ANNUAL_RANKS = [
  { value: "first", ar: "الأول", en: "First" },
  { value: "second", ar: "الثاني", en: "Second" },
  { value: "third", ar: "الثالث", en: "Third" },
  { value: "fourth", ar: "الرابع", en: "Fourth" },
  { value: "fifth", ar: "الخامس", en: "Fifth" },
  { value: "sixth", ar: "السادس", en: "Sixth" },
  { value: "seventh", ar: "السابع", en: "Seventh" },
  { value: "eighth", ar: "الثامن", en: "Eighth" },
  { value: "ninth", ar: "التاسع", en: "Ninth" },
  { value: "tenth", ar: "العاشر", en: "Tenth" },
] as const;

// Mawhiba Annual Subjects
export const MAWHIBA_ANNUAL_SUBJECTS = [
  { value: "full_test", ar: "الاختبار كامل", en: "Full Test" },
  { value: "science", ar: "علوم", en: "Science" },
  { value: "mathematics", ar: "رياضيات", en: "Mathematics" },
  { value: "physics", ar: "فيزياء", en: "Physics" },
  { value: "chemistry", ar: "كيمياء", en: "Chemistry" },
] as const;

/**
 * Get achievement names filtered by type
 */
export function getAchievementNamesByType(type: string): Array<{ value: string; ar: string; en: string }> {
  switch (type) {
    case "competition":
      return COMPETITION_OPTIONS.map((c) => ({ value: c.value, ar: c.ar, en: c.en }));
    case "program":
      return PROGRAM_OPTIONS.map((p) => ({ value: p.value, ar: p.ar, en: p.en }));
    case "exhibition":
      return EXHIBITION_OPTIONS.map((e) => ({ value: e.value, ar: e.ar, en: e.en }));
    case "olympiad":
      return OLYMPIAD_MEETINGS.map((m) => ({ value: m.value, ar: m.ar, en: m.en }));
    case "excellence_program":
      return EXCELLENCE_PROGRAM_OPTIONS.map((e) => ({ value: e.value, ar: e.ar, en: e.en }));
    case "qudrat":
      return QUDRAT_TIER_OPTIONS.map((s) => ({ value: s.value, ar: s.ar, en: s.en }));
    case "mawhiba_annual":
      return MAWHIBA_ANNUAL_RANKS.map((r) => ({ value: r.value, ar: r.ar, en: r.en }));
    case "gifted_discovery":
      return [{ value: "exceptional_gifted", ar: "موهوب استثنائي", en: "Exceptional Gifted" }];
    default:
      return [];
  }
}
