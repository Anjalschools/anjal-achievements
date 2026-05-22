/**
 * Auto-fill, validation, and UI↔DB resolution for special achievement UI categories.
 */

import {
  EARLY_UNIVERSITY_EVENT_VALUES,
  EARLY_UNIVERSITY_OTHER_VALUE,
  ENTREPRENEURSHIP_EVENT_VALUES,
  INTERNATIONAL_UNIVERSITY_SLUGS,
  SAUDI_ARAB_UNIVERSITY_SLUGS,
  isInternationalUniversitySlug,
  isSaudiArabUniversitySlug,
  isSpecialUiCategory,
  TRAINING_MODE_VALUES,
  UI_CATEGORY_EARLY_UNIVERSITY,
  UI_CATEGORY_ENTREPRENEURSHIP,
  UI_CATEGORY_TRAINING_COURSES,
  getEarlyUniversityEventLabel,
} from "@/constants/achievement-special-categories";

export type UniversityAchievementLevel = "kingdom" | "international";

export type ResolveUniversityLevelInput = {
  universitySlug?: string;
  customUniversityName?: string;
  /** Optional free text (description, OCR, nomination) for "other" inference */
  corpusText?: string;
};

const INTERNATIONAL_UNI_NAME_PATTERNS: RegExp[] = [
  /\bmit\b/i,
  /massachusetts institute of technology/i,
  /stanford/i,
  /harvard/i,
  /carnegie mellon/i,
  /berkeley/i,
  /georgia tech/i,
  /georgia institute of technology/i,
  /university of toronto/i,
  /university of oxford/i,
  /university of cambridge/i,
  /oxford university/i,
  /cambridge university/i,
  /yale\b/i,
  /princeton\b/i,
  /columbia university/i,
  /caltech/i,
  /imperial college/i,
  /eth zurich/i,
  /\buniversity of\b/i,
  /\binstitute of technology\b/i,
  /\bcollege\b/i,
];

const SAUDI_GULF_ARAB_UNI_NAME_PATTERNS: RegExp[] = [
  /جامعة/,
  /الملك فهد/,
  /الملك سعود/,
  /الملك عبدالله/,
  /الأمير محمد/,
  /الفيصل/,
  /المملكة/,
  /السعودية/,
  /سعودي/,
  /aramco/i,
  /saudi aramco/i,
  /kfupm/i,
  /kaust/i,
  /ksu\b/i,
  /pmf\b/i,
  /alfaisal/i,
  /الخليج/,
  /الإمارات/,
  /قطر/,
  /البحرين/,
  /الكويت/,
  /عمان/,
  /مصر/,
  /الأردن/,
  /لبنان/,
];

const isPredominantlyLatinText = (text: string): boolean => {
  const t = text.trim();
  if (!t) return false;
  const latin = (t.match(/[a-zA-Z]/g) || []).length;
  const arabic = (t.match(/[\u0600-\u06FF]/g) || []).length;
  if (latin === 0 && arabic === 0) return false;
  return latin >= arabic;
};

const matchesAnyPattern = (text: string, patterns: RegExp[]): boolean => {
  const t = text.trim();
  if (!t) return false;
  return patterns.some((p) => p.test(t));
};

/**
 * Resolves achievementLevel for early university admission:
 * - Saudi/Arab/Gulf → `kingdom` (المملكة)
 * - International list / English global names → `international` (دولي)
 */
export const resolveUniversityAchievementLevel = (
  input: ResolveUniversityLevelInput
): UniversityAchievementLevel => {
  const slug = String(input.universitySlug || "").trim();
  const custom = String(input.customUniversityName || "").trim();
  const corpus = String(input.corpusText || "").trim();
  const combined = [custom, corpus].filter(Boolean).join(" ");

  if (slug && slug !== EARLY_UNIVERSITY_OTHER_VALUE) {
    if (isInternationalUniversitySlug(slug)) return "international";
    if (isSaudiArabUniversitySlug(slug)) return "kingdom";
  }

  const textForOther = [custom, corpus].filter(Boolean).join(" ").trim();
  if (!textForOther) return "kingdom";

  if (matchesAnyPattern(textForOther, INTERNATIONAL_UNI_NAME_PATTERNS)) {
    return "international";
  }
  if (matchesAnyPattern(textForOther, SAUDI_GULF_ARAB_UNI_NAME_PATTERNS)) {
    return "kingdom";
  }

  if (isPredominantlyLatinText(textForOther)) {
    return "international";
  }

  return "kingdom";
};

/** True when slug is a known university (not "other") */
export const isConfirmedUniversitySlug = (slug: string): boolean => {
  const s = String(slug || "").trim();
  if (!s || s === EARLY_UNIVERSITY_OTHER_VALUE) return false;
  return (
    INTERNATIONAL_UNIVERSITY_SLUGS.has(s) ||
    SAUDI_ARAB_UNIVERSITY_SLUGS.has(s)
  );
};

export type EntrepreneurshipMeta = {
  activityTypeDetail?: string;
  approximateCapital?: string;
  branchCount?: string;
  customerCount?: string;
  projectSummary?: string;
  storeOrBusinessUrl?: string;
  businessCategory?: string;
};

export const ENTREPRENEURSHIP_META_BLOCK_OPEN = "[ENTREPRENEURSHIP_META]";
export const ENTREPRENEURSHIP_META_BLOCK_CLOSE = "[/ENTREPRENEURSHIP_META]";
const ENT_META_LEGACY_JSON = "__TAMIZ_ENT__";

const normalizeMetaLineKey = (k: string): keyof EntrepreneurshipMeta | null => {
  const key = k.trim().toLowerCase();
  const map: Record<string, keyof EntrepreneurshipMeta> = {
    capital: "approximateCapital",
    approximatecapital: "approximateCapital",
    branches: "branchCount",
    branchcount: "branchCount",
    customers: "customerCount",
    customercount: "customerCount",
    businesstype: "activityTypeDetail",
    activitytypedetail: "activityTypeDetail",
    businesscategory: "businessCategory",
    storeurl: "storeOrBusinessUrl",
    storeorbusinessurl: "storeOrBusinessUrl",
    projectsummary: "projectSummary",
    summary: "projectSummary",
  };
  return map[key] ?? null;
};

const parseStructuredEntrepreneurshipBlock = (block: string): EntrepreneurshipMeta => {
  const meta: EntrepreneurshipMeta = {};
  for (const line of block.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("[") || !t.includes("=")) continue;
    const eq = t.indexOf("=");
    const rawKey = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!val) continue;
    const mapped = normalizeMetaLineKey(rawKey);
    if (mapped) meta[mapped] = val;
  }
  return meta;
};

export const serializeEntrepreneurshipMeta = (meta: EntrepreneurshipMeta): string => {
  const lines: string[] = [];
  if (meta.approximateCapital?.trim()) lines.push(`capital=${meta.approximateCapital.trim()}`);
  if (meta.branchCount?.trim()) lines.push(`branches=${meta.branchCount.trim()}`);
  if (meta.customerCount?.trim()) lines.push(`customers=${meta.customerCount.trim()}`);
  if (meta.activityTypeDetail?.trim()) lines.push(`businessType=${meta.activityTypeDetail.trim()}`);
  if (meta.businessCategory?.trim()) lines.push(`businessCategory=${meta.businessCategory.trim()}`);
  if (meta.storeOrBusinessUrl?.trim()) lines.push(`storeUrl=${meta.storeOrBusinessUrl.trim()}`);
  if (meta.projectSummary?.trim()) lines.push(`summary=${meta.projectSummary.trim()}`);
  if (lines.length === 0) return "";
  return `${ENTREPRENEURSHIP_META_BLOCK_OPEN}\n${lines.join("\n")}\n${ENTREPRENEURSHIP_META_BLOCK_CLOSE}`;
};

export const parseEntrepreneurshipMetaFromDescription = (
  description: string
): { userDescription: string; meta: EntrepreneurshipMeta } => {
  const raw = String(description || "");

  const openIdx = raw.indexOf(ENTREPRENEURSHIP_META_BLOCK_OPEN);
  if (openIdx >= 0) {
    const closeIdx = raw.indexOf(ENTREPRENEURSHIP_META_BLOCK_CLOSE, openIdx);
    const userDescription =
      closeIdx >= 0
        ? `${raw.slice(0, openIdx)}${raw.slice(closeIdx + ENTREPRENEURSHIP_META_BLOCK_CLOSE.length)}`.trim()
        : raw.slice(0, openIdx).trim();
    const inner =
      closeIdx >= 0
        ? raw.slice(openIdx + ENTREPRENEURSHIP_META_BLOCK_OPEN.length, closeIdx)
        : raw.slice(openIdx + ENTREPRENEURSHIP_META_BLOCK_OPEN.length);
    return { userDescription, meta: parseStructuredEntrepreneurshipBlock(inner) };
  }

  const legacyIdx = raw.indexOf(ENT_META_LEGACY_JSON);
  if (legacyIdx >= 0) {
    const userDescription = raw.slice(0, legacyIdx).trim();
    const jsonPart = raw.slice(legacyIdx + ENT_META_LEGACY_JSON.length).trim();
    try {
      const parsed = JSON.parse(jsonPart) as EntrepreneurshipMeta;
      return { userDescription, meta: parsed && typeof parsed === "object" ? parsed : {} };
    } catch {
      return { userDescription: raw.trim(), meta: {} };
    }
  }

  return { userDescription: raw.trim(), meta: {} };
};

export const mergeDescriptionWithEntrepreneurshipMeta = (
  userDescription: string,
  meta: EntrepreneurshipMeta
): string => {
  const base = String(userDescription || "").trim();
  const block = serializeEntrepreneurshipMeta(meta);
  if (!block) return base;
  return base ? `${base}\n\n${block}` : block;
};

export const inferUiCategoryFromStoredAchievement = (input: {
  achievementType: string;
  achievementName?: string;
  achievementCategory?: string;
  description?: string;
}): string | null => {
  const name = String(input.achievementName || "").trim();
  const desc = String(input.description || "");

  if (EARLY_UNIVERSITY_EVENT_VALUES.has(name)) {
    return UI_CATEGORY_EARLY_UNIVERSITY;
  }

  if (ENTREPRENEURSHIP_EVENT_VALUES.has(name)) {
    return UI_CATEGORY_ENTREPRENEURSHIP;
  }

  if (TRAINING_MODE_VALUES.has(name)) {
    return UI_CATEGORY_TRAINING_COURSES;
  }

  if (
    desc.includes(ENTREPRENEURSHIP_META_BLOCK_OPEN) ||
    desc.includes(ENT_META_LEGACY_JSON)
  ) {
    return UI_CATEGORY_ENTREPRENEURSHIP;
  }

  return null;
};

export const mapSpecialUiCategoryToDbAchievementType = (ui: string): string => {
  switch (ui) {
    case UI_CATEGORY_EARLY_UNIVERSITY:
    case UI_CATEGORY_TRAINING_COURSES:
      return "program";
    case UI_CATEGORY_ENTREPRENEURSHIP:
      return "other";
    default:
      return "other";
  }
};

export const getAutoLocksForSpecialUiCategory = (
  ui: string,
  context?: { achievementName?: string; customAchievementName?: string }
): {
  level: string | null;
  participationType: string | null;
  resultType: string | null;
  inferredField: string | null;
  levelLocked: boolean;
  participationLocked: boolean;
  resultLocked: boolean;
} => {
  switch (ui) {
    case UI_CATEGORY_EARLY_UNIVERSITY: {
      const slug = String(context?.achievementName || "").trim();
      const level = slug
        ? resolveUniversityAchievementLevel({
            universitySlug: slug,
            customUniversityName: context?.customAchievementName,
          })
        : "kingdom";
      return {
        level,
        participationType: "individual",
        resultType: "nomination",
        inferredField: "academic_development",
        levelLocked: true,
        participationLocked: true,
        resultLocked: true,
      };
    }
    case UI_CATEGORY_ENTREPRENEURSHIP:
      return {
        level: "province",
        participationType: "individual",
        resultType: "participation",
        inferredField: null,
        levelLocked: true,
        participationLocked: true,
        resultLocked: true,
      };
    case UI_CATEGORY_TRAINING_COURSES:
      return {
        level: "province",
        participationType: "individual",
        resultType: "participation",
        inferredField: null,
        levelLocked: true,
        participationLocked: true,
        resultLocked: true,
      };
    default:
      return {
        level: null,
        participationType: null,
        resultType: null,
        inferredField: null,
        levelLocked: false,
        participationLocked: false,
        resultLocked: false,
      };
  }
};

export const buildAutoNominationTextForEarlyUniversity = (
  achievementName: string,
  customUniversityName: string,
  locale: "ar" | "en"
): string => {
  if (achievementName === EARLY_UNIVERSITY_OTHER_VALUE) {
    const custom = customUniversityName.trim();
    return custom || (locale === "ar" ? "قبول مبكر بالجامعات" : "Early university admission");
  }
  const label = getEarlyUniversityEventLabel(achievementName, locale);
  return locale === "ar" ? `ترشيح / قبول مبكر — ${label}` : `Early admission / nomination — ${label}`;
};

export const requiresAttachmentEvidenceForUiCategory = (ui: string): boolean =>
  isSpecialUiCategory(ui);

export const validateSpecialCategoryClient = (
  ui: string,
  data: Record<string, unknown>,
  locale: "ar" | "en"
): Record<string, string> => {
  const errors: Record<string, string> = {};
  const isAr = locale === "ar";

  if (ui === UI_CATEGORY_EARLY_UNIVERSITY) {
    const name = String(data.achievementName || "").trim();
    if (name === EARLY_UNIVERSITY_OTHER_VALUE && !String(data.customAchievementName || "").trim()) {
      errors.customAchievementName = isAr ? "اسم الجامعة مطلوب" : "University name is required";
    }
  }

  if (ui === UI_CATEGORY_ENTREPRENEURSHIP) {
    if (!String(data.entActivityTypeDetail || "").trim()) {
      errors.entActivityTypeDetail = isAr
        ? "تحديد نوع النشاط مطلوب"
        : "Activity type detail is required";
    }
  }

  if (ui === UI_CATEGORY_TRAINING_COURSES) {
    const mode = String(data.achievementName || "").trim();
    if (!TRAINING_MODE_VALUES.has(mode)) {
      errors.achievementName = isAr ? "اختر حضوري أو أونلاين" : "Select in-person or online";
    }
    if (!String(data.trainingCourseName || "").trim()) {
      errors.trainingCourseName = isAr ? "اسم الدورة التدريبية مطلوب" : "Course name is required";
    }
    if (!String(data.trainingHours || "").trim()) {
      errors.trainingHours = isAr ? "عدد ساعات التدريب مطلوب" : "Training hours are required";
    }
  }

  if (requiresAttachmentEvidenceForUiCategory(ui)) {
    const attachments = data.attachments;
    const hasAttachment = Array.isArray(attachments) && attachments.length > 0;
    if (!hasAttachment) {
      errors.attachments = isAr
        ? "يجب رفع مرفق واحد على الأقل (إثبات رسمي)"
        : "Upload at least one attachment (official proof)";
    }
  }

  return errors;
};

export const validateSpecialCategoryServer = (
  payload: {
    achievementType: string;
    achievementName: string;
    customAchievementName?: string;
    attachments?: unknown[];
    description?: string;
    nominationText?: string;
    resultValue?: string;
  }
): string[] => {
  const errors: string[] = [];
  const name = String(payload.achievementName || "").trim();

  if (EARLY_UNIVERSITY_EVENT_VALUES.has(name)) {
    if (name === EARLY_UNIVERSITY_OTHER_VALUE && !String(payload.customAchievementName || "").trim()) {
      errors.push("University name is required when Other is selected");
    }
    if (!String(payload.nominationText || "").trim()) {
      errors.push("Nomination text is required for early university admission");
    }
  }

  if (ENTREPRENEURSHIP_EVENT_VALUES.has(name)) {
    const { meta } = parseEntrepreneurshipMetaFromDescription(String(payload.description || ""));
    if (!String(meta.activityTypeDetail || "").trim()) {
      errors.push("Entrepreneurship activity type detail is required");
    }
  }

  if (TRAINING_MODE_VALUES.has(name)) {
    if (!String(payload.customAchievementName || "").trim()) {
      errors.push("Training course name is required");
    }
    if (!String(payload.resultValue || "").trim()) {
      errors.push("Training hours are required");
    }
  }

  const isSpecialStored =
    EARLY_UNIVERSITY_EVENT_VALUES.has(name) ||
    ENTREPRENEURSHIP_EVENT_VALUES.has(name) ||
    TRAINING_MODE_VALUES.has(name);

  if (isSpecialStored) {
    const att = payload.attachments;
    if (!Array.isArray(att) || att.length === 0) {
      errors.push("At least one attachment is required for this achievement category");
    }
  }

  return errors;
};

const TRAINING_COURSE_FIELD_RULES: Array<{ keywords: string[]; field: string }> = [
  { keywords: ["cybersecurity", "security", "soc", "أمن سيبراني", "سيبراني"], field: "cybersecurity" },
  { keywords: ["networking", "شبكات", "network"], field: "technology" },
  { keywords: ["cloud", "devops", "سحاب"], field: "technology_innovation" },
  {
    keywords: [
      "programming",
      "python",
      "javascript",
      "web development",
      "برمجة",
      "بايثون",
      "تطوير ويب",
    ],
    field: "informatics",
  },
  {
    keywords: [
      "artificial intelligence",
      "machine learning",
      "deep learning",
      " ai ",
      "ذكاء اصطناعي",
      "تعلم آلي",
    ],
    field: "technology_innovation",
  },
  { keywords: ["robotics", "روبوت"], field: "robotics" },
  {
    keywords: ["data science", "data analysis", "تحليل بيانات", "علم البيانات"],
    field: "stem",
  },
  {
    keywords: [
      "leadership",
      "entrepreneurship",
      "management",
      "marketing",
      "finance",
      " hr ",
      "public speaking",
      "قيادة",
      "ريادة",
      "إدارة",
      "تسويق",
      "مالية",
      "موارد بشرية",
      "خطابة",
    ],
    field: "academic_development",
  },
  {
    keywords: ["teaching", "classroom", "education", "stem", "تعليم", "فصل", "تربية"],
    field: "science",
  },
  {
    keywords: ["design", " ui ", " ux ", "graphic", "تصميم", "واجهة"],
    field: "cultural",
  },
  { keywords: ["رياضيات", "mathematics", "math"], field: "mathematics" },
  { keywords: ["فيزياء", "physics"], field: "physics" },
  { keywords: ["كيمياء", "chemistry"], field: "chemistry" },
  { keywords: ["أحياء", "biology"], field: "biology" },
  { keywords: ["علوم", "science"], field: "science" },
  { keywords: ["تقنية", "technology", "tech"], field: "technology" },
];

export const inferTrainingCourseField = (courseName: string): string | null => {
  const t = courseName.trim().toLowerCase();
  if (!t) return null;
  for (const rule of TRAINING_COURSE_FIELD_RULES) {
    if (rule.keywords.some((k) => t.includes(k.trim().toLowerCase()))) return rule.field;
  }
  return null;
};
