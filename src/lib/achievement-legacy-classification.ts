/**
 * Legacy achievement text/slug classification (pure, non-destructive).
 * Used by backfill scripts, analytics helpers, OCR/AI pipelines.
 */

import {
  isManuallyProtectedAchievement,
  resolveBackfillProtectionFlags,
  type AchievementBackfillProtectionFlags,
  type AchievementBackfillProtectionRow,
} from "@/lib/achievement-backfill-protection";
import {
  EARLY_UNIVERSITY_EVENT_OPTIONS,
  EARLY_UNIVERSITY_EVENT_VALUES,
  EARLY_UNIVERSITY_OTHER_VALUE,
  ENTREPRENEURSHIP_EVENT_OPTIONS,
  TRAINING_MODE_IN_PERSON,
  TRAINING_MODE_ONLINE,
  UI_CATEGORY_EARLY_UNIVERSITY,
  UI_CATEGORY_ENTREPRENEURSHIP,
  UI_CATEGORY_TRAINING_COURSES,
} from "@/constants/achievement-special-categories";
import {
  inferTrainingCourseField,
  inferUiCategoryFromStoredAchievement,
  isConfirmedUniversitySlug,
  resolveUniversityAchievementLevel,
} from "@/lib/achievement-special-category-rules";
import { PROGRAM_OPTIONS } from "@/constants/achievement-options";

/** Bump when classification rules change (audit / rollback). */
export const CLASSIFIER_VERSION = "2026.05.22-v1";

export type LegacyConfidenceLevel = "high" | "medium" | "low";

export type LegacyCategorySlug =
  | typeof UI_CATEGORY_TRAINING_COURSES
  | typeof UI_CATEGORY_EARLY_UNIVERSITY
  | typeof UI_CATEGORY_ENTREPRENEURSHIP;

export type LegacyAchievementInput = AchievementBackfillProtectionRow & {
  achievementType?: string;
  achievementCategory?: string;
  achievementName?: string;
  title?: string;
  nameAr?: string;
  nameEn?: string;
  customAchievementName?: string;
  description?: string;
  organization?: string;
  achievementLevel?: string;
  participationType?: string;
  resultType?: string;
  resultValue?: string;
  nominationText?: string;
  inferredField?: string;
  evidenceUrl?: string;
  evidenceFileName?: string;
  extractedText?: string;
  ocrText?: string;
  aiSummary?: string;
  evidenceExtractedData?: Record<string, unknown> | null;
};

export type LegacyClassificationResult = {
  category: LegacyCategorySlug | null;
  confidence: LegacyConfidenceLevel;
  /** 0–100 internal score for ranking */
  score: number;
  reasons: string[];
  matchedSignals: string[];
  negativeSignals: string[];
  universitySlug?: string;
  universityLabel?: string;
  trainingMode?: typeof TRAINING_MODE_IN_PERSON | typeof TRAINING_MODE_ONLINE;
  trainingHours?: string;
  trainingCourseTitle?: string;
  trainingField?: string;
  entrepreneurshipEventSlug?: string;
  businessTypeHint?: string;
};

export type LegacyBackfillPatch = {
  achievementCategory: LegacyCategorySlug;
  achievementLevel?: string;
  participationType?: string;
  resultType?: string;
  nominationText?: string;
  resultValue?: string;
  customAchievementName?: string;
  achievementName?: string;
  inferredField?: string;
  evidenceExtractedData?: Record<string, unknown>;
};

const PROGRAM_NAME_SLUGS = new Set<string>(PROGRAM_OPTIONS.map((o) => String(o.value)));

const SPECIAL_CATEGORIES = new Set([
  UI_CATEGORY_EARLY_UNIVERSITY,
  UI_CATEGORY_ENTREPRENEURSHIP,
  UI_CATEGORY_TRAINING_COURSES,
  "standardized_tests",
]);

const SKIP_ACHIEVEMENT_TYPES = new Set([
  "qudrat",
  "mawhiba_annual",
  "gifted_discovery",
  "sat",
  "ielts",
  "toefl",
]);

const normalizeText = (parts: Array<string | undefined | null>): string =>
  parts
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

const containsAny = (haystack: string, needles: string[]): string[] =>
  needles.filter((n) => {
    const k = n.trim().toLowerCase();
    return k.length > 0 && haystack.includes(k);
  });

const scoreToConfidence = (score: number, hitCount: number): LegacyConfidenceLevel => {
  if (score >= 78 || (score >= 65 && hitCount >= 3)) return "high";
  if (score >= 52 || (score >= 45 && hitCount >= 2)) return "medium";
  return "low";
};

const GLOBAL_NEGATIVE_SIGNALS = [
  "simulation",
  "simulated",
  "hypothetical",
  "hypothetical scenario",
  "proposal only",
  "draft proposal",
  "class project",
  "school project",
  "course project",
  "مشروع مادة",
  "مشروع صفي",
  "نشاط صفي",
  "نشاط مدرسي",
  "مثال تدريبي",
  "تمرين صفي",
  "for practice",
  "practice exercise",
  "mock interview",
  "role play",
  "تمثيل",
];

const UNIVERSITY_NEGATIVE_SIGNALS = [
  "mit opencourseware",
  "opencourseware",
  "mit scratch",
  "visited mit",
  "زيارة معرض",
  "university fair",
  "جامعة في المنام",
  "dream university",
];

const ENTREPRENEURSHIP_NEGATIVE_SIGNALS = [
  "مشروع مادة",
  "نشاط صفي",
  "نشاط مدرسي",
  "class project",
  "school project",
  "مثال تدريبي",
  "محاكاة",
  "simulation",
  "hypothetical",
];

const TRAINING_NEGATIVE_SIGNALS = [
  "مثال تدريبي",
  "تمرين",
  "practice only",
  "demo course",
];

const applyNegativePenalty = (
  result: LegacyClassificationResult,
  negatives: string[],
  penaltyPerHit: number
): LegacyClassificationResult | null => {
  if (negatives.length === 0) return result;
  const penalty = negatives.length * penaltyPerHit;
  const score = Math.max(0, result.score - penalty);
  const reasons = [
    ...result.reasons,
    `negative_signals:${negatives.slice(0, 6).join(",")}`,
  ];
  const hitCount = Math.max(0, result.matchedSignals.length - negatives.length);
  const confidence = scoreToConfidence(score, hitCount);
  if (negatives.length >= 2 || confidence === "low") return null;
  return {
    ...result,
    score,
    confidence,
    reasons,
    negativeSignals: [...result.negativeSignals, ...negatives],
  };
};

const collectNegativeHits = (corpus: string, needles: string[]): string[] =>
  containsAny(corpus, needles);

type UniversityMultiSignals = {
  knownUniversity: boolean;
  admissionKeywords: boolean;
  officialDocument: boolean;
  ocrAcceptanceLetter: boolean;
  matched: string[];
};

const OFFICIAL_DOC_HINTS = [
  ".pdf",
  "offer letter",
  "admission letter",
  "acceptance letter",
  "خطاب قبول",
  "خطاب ترشيح",
  "conditional offer",
  "letter of admission",
];

const OCR_ACCEPTANCE_HINTS = [
  "خطاب قبول",
  "خطاب ترشيح",
  "letter of admission",
  "offer letter",
  "acceptance letter",
  "admitted to",
  "congratulations on your admission",
  "conditional acceptance",
];

const detectOfficialDocument = (input: LegacyAchievementInput, corpus: string): boolean => {
  const fn = String(input.evidenceFileName || "").toLowerCase();
  const url = String(input.evidenceUrl || "").toLowerCase();
  const blob = `${fn} ${url} ${corpus}`;
  if (/\.pdf\b|application\/pdf/.test(blob)) return true;
  return OFFICIAL_DOC_HINTS.some((h) => blob.includes(h.toLowerCase()));
};

const detectOcrAcceptanceLetter = (input: LegacyAchievementInput): boolean => {
  const ocr =
    String(input.ocrText || "") ||
    (typeof input.evidenceExtractedData?.ocrText === "string"
      ? String(input.evidenceExtractedData.ocrText)
      : "") ||
    (typeof input.evidenceExtractedData?.rawText === "string"
      ? String(input.evidenceExtractedData.rawText)
      : "");
  const t = ocr.toLowerCase();
  if (!t.trim()) return false;
  return OCR_ACCEPTANCE_HINTS.some((h) => t.includes(h.toLowerCase()));
};

const isWeakUniversityPattern = (slug: string, matchedKeyword: string): boolean => {
  if (slug === "uni_mit" && /\bmit\b/i.test(matchedKeyword)) return true;
  if (slug === "uni_ksu" && matchedKeyword.trim() === "ksu") return true;
  return false;
};

const meetsUniversityMultiSignalGate = (signals: UniversityMultiSignals): boolean => {
  const count = [
    signals.knownUniversity,
    signals.admissionKeywords,
    signals.officialDocument,
    signals.ocrAcceptanceLetter,
  ].filter(Boolean).length;
  if (count < 2) return false;
  const hasAdmissionEvidence =
    signals.admissionKeywords || signals.ocrAcceptanceLetter;
  const hasUniversityAnchor =
    signals.knownUniversity || signals.officialDocument || signals.ocrAcceptanceLetter;
  return hasAdmissionEvidence && hasUniversityAnchor;
};

const extractTrainingHours = (text: string): string | undefined => {
  const patterns = [
    /(\d{1,4})\s*(?:ساعة|ساعات|hour|hours|hrs|h)\b/i,
    /(?:training\s*hours?|hours?\s*of\s*training)\s*[:\-]?\s*(\d{1,4})/i,
    /(\d{1,4})\s*(?:training\s*hours?)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n <= 2000) return String(n);
    }
  }
  return undefined;
};

const TRAINING_KEYWORDS = [
  "دورة تدريبية",
  "دورة",
  "شهادة حضور",
  "شهادة إتمام",
  "شهادة اتمام",
  "تدريب إلكتروني",
  "تدريب",
  "ساعات تدريب",
  "ورشة",
  "ورشة عمل",
  "معسكر",
  "bootcamp",
  "أكاديمية",
  "عن بعد",
  "حضور",
  "certificate of completion",
  "training hours",
  "training hour",
  "workshop",
  "boot camp",
  "bootcamp",
  "online course",
  "training course",
  "course completion",
  "attendance certificate",
  "certification course",
];

const TRAINING_ONLINE_KEYWORDS = [
  "أونلاين",
  "اونلاين",
  "عن بعد",
  "عن بُعد",
  "online",
  "remote",
  "virtual",
  "distance learning",
  "e-learning",
  "elearning",
];

const TRAINING_IN_PERSON_KEYWORDS = [
  "حضوري",
  "حضور",
  "in-person",
  "in person",
  "on-site",
  "onsite",
  "face to face",
];

const UNIVERSITY_PATTERNS: Array<{
  slug: string;
  patterns: string[];
  weight: number;
}> = [
  { slug: "uni_kfupm", patterns: ["جامعة الملك فهد", "kfupm", "king fahd university"], weight: 12 },
  {
    slug: "uni_aramco",
    patterns: ["saudi aramco", "aramco", "برامج التدرج", "ابتعاث", "موهوبين aramco"],
    weight: 11,
  },
  { slug: "uni_ksu", patterns: ["جامعة الملك سعود", "king saud university", "ksu"], weight: 11 },
  { slug: "uni_kaust", patterns: ["kaust", "جامعة الملك عبدالله"], weight: 11 },
  { slug: "uni_pmf", patterns: ["جامعة الأمير محمد", "pmf", "prince mohammad"], weight: 10 },
  { slug: "uni_alfaisal", patterns: ["جامعة الفيصل", "alfaisal"], weight: 10 },
  { slug: "uni_mit", patterns: ["massachusetts institute of technology"], weight: 14 },
  { slug: "uni_mit", patterns: [" mit "], weight: 5 },
  { slug: "uni_stanford", patterns: ["stanford"], weight: 12 },
  { slug: "uni_harvard", patterns: ["harvard"], weight: 12 },
  { slug: "uni_cmu", patterns: ["carnegie mellon"], weight: 12 },
  { slug: "uni_ucb", patterns: ["berkeley", "uc berkeley"], weight: 11 },
  { slug: "uni_gatech", patterns: ["georgia tech", "georgia institute"], weight: 11 },
  { slug: "uni_toronto", patterns: ["university of toronto"], weight: 11 },
  { slug: "uni_oxford", patterns: ["university of oxford", "oxford university"], weight: 12 },
  { slug: "uni_cambridge", patterns: ["university of cambridge", "cambridge university"], weight: 12 },
];

const ADMISSION_SIGNAL_KEYWORDS = [
  "خطاب قبول",
  "قبول مبكر",
  "قبول جامعي",
  "ترشيح",
  "conditional acceptance",
  "conditional offer",
  "offer letter",
  "admission letter",
  "letter of admission",
  "early admission",
  "university admission",
  "acceptance letter",
  "قبول موهوبين",
  "stem program",
  "برنامج موهوبين",
  "college admission",
  "admitted to",
];

const ENTREPRENEURSHIP_KEYWORDS = [
  "متجر إلكتروني",
  "متجر الكتروني",
  "متجر انستقرام",
  "متجر إلكتروني",
  "نشاط تجاري",
  "مؤسسة فردية",
  "أسر منتجة",
  "سلة",
  " زد ",
  "online store",
  "ecommerce",
  "e-commerce",
  "entrepreneur",
  "startup",
  "مشروع تجاري",
  "تجارة",
  "متجر",
  "مصنع",
  "مكتب",
  "شركة ناشئة",
];

const ENT_EVENT_BY_KEYWORD: Array<{ slug: string; patterns: string[]; weight: number }> = [
  { slug: "ent_ecommerce", patterns: ["متجر إلكتروني", "online store", "ecommerce", "e-commerce", "سلة", "زد"], weight: 14 },
  { slug: "ent_shop", patterns: ["متجر", "shop", "store", "commerce"], weight: 10 },
  { slug: "ent_factory", patterns: ["مصنع", "factory", "manufacturing"], weight: 12 },
  { slug: "ent_office", patterns: ["مكتب", "office", "consulting"], weight: 10 },
  { slug: "ent_home_business", patterns: ["أسر منتجة", "home business", "منزلي"], weight: 11 },
];

export const buildLegacySearchCorpus = (input: LegacyAchievementInput): string => {
  const extracted =
    input.extractedText ||
    (typeof input.evidenceExtractedData?.rawText === "string"
      ? String(input.evidenceExtractedData.rawText)
      : "") ||
    (typeof input.evidenceExtractedData?.ocrText === "string"
      ? String(input.evidenceExtractedData.ocrText)
      : "") ||
    (typeof input.evidenceExtractedData?.extractedText === "string"
      ? String(input.evidenceExtractedData.extractedText)
      : "");

  return normalizeText([
    input.achievementName,
    input.customAchievementName,
    input.title,
    input.nameAr,
    input.nameEn,
    input.description,
    input.organization,
    input.evidenceFileName,
    input.evidenceUrl,
    input.aiSummary,
    input.ocrText,
    extracted,
  ]);
};

/** Re-export for pipelines */
export { inferTrainingCourseField, resolveUniversityAchievementLevel };

export const inferUniversityAdmission = (
  input: LegacyAchievementInput
): LegacyClassificationResult | null => {
  const corpus = buildLegacySearchCorpus(input);
  if (!corpus) return null;

  const negatives = [
    ...collectNegativeHits(corpus, GLOBAL_NEGATIVE_SIGNALS),
    ...collectNegativeHits(corpus, UNIVERSITY_NEGATIVE_SIGNALS),
  ];

  const admissionHits = containsAny(corpus, ADMISSION_SIGNAL_KEYWORDS);
  let bestUni: { slug: string; weight: number; label: string; weak: boolean } | null =
    null;

  for (const u of UNIVERSITY_PATTERNS) {
    const hits = containsAny(corpus, u.patterns);
    if (hits.length === 0) continue;
    const weak = hits.some((h) => isWeakUniversityPattern(u.slug, h));
    if (weak && admissionHits.length === 0) continue;
    const row = EARLY_UNIVERSITY_EVENT_OPTIONS.find((o) => o.value === u.slug);
    const candidate = {
      slug: u.slug,
      weight: u.weight + hits.length * 4,
      label: row ? row.ar : u.slug,
      weak,
    };
    if (!bestUni || candidate.weight > bestUni.weight) bestUni = candidate;
  }

  const multi: UniversityMultiSignals = {
    knownUniversity: Boolean(bestUni && (!bestUni.weak || admissionHits.length > 0)),
    admissionKeywords: admissionHits.length > 0,
    officialDocument: detectOfficialDocument(input, corpus),
    ocrAcceptanceLetter: detectOcrAcceptanceLetter(input),
    matched: [],
  };
  if (multi.knownUniversity && bestUni) multi.matched.push(`university:${bestUni.slug}`);
  if (multi.admissionKeywords) multi.matched.push(`admission_keywords:${admissionHits.length}`);
  if (multi.officialDocument) multi.matched.push("official_document");
  if (multi.ocrAcceptanceLetter) multi.matched.push("ocr_acceptance_letter");

  if (!meetsUniversityMultiSignalGate(multi)) return null;

  let score = admissionHits.length * 14 + (bestUni?.weight ?? 0);
  if (multi.officialDocument) score += 10;
  if (multi.ocrAcceptanceLetter) score += 12;
  const reasons: string[] = [`multi_signal:${multi.matched.join("|")}`];
  if (admissionHits.length) reasons.push(`admission_keywords:${admissionHits.slice(0, 4).join(",")}`);
  if (bestUni) reasons.push(`university_match:${bestUni.slug}`);

  const hitCount = multi.matched.length;
  let confidence = scoreToConfidence(score, hitCount);
  if (confidence === "low") return null;

  let result: LegacyClassificationResult = {
    category: UI_CATEGORY_EARLY_UNIVERSITY,
    confidence,
    score,
    reasons,
    matchedSignals: multi.matched,
    negativeSignals: negatives,
    universitySlug: bestUni?.slug ?? EARLY_UNIVERSITY_OTHER_VALUE,
    universityLabel: bestUni?.label,
  };

  return applyNegativePenalty(result, negatives, 20);
};

export const inferEntrepreneurship = (
  input: LegacyAchievementInput
): LegacyClassificationResult | null => {
  const corpus = buildLegacySearchCorpus(input);
  if (!corpus) return null;

  const negatives = [
    ...collectNegativeHits(corpus, GLOBAL_NEGATIVE_SIGNALS),
    ...collectNegativeHits(corpus, ENTREPRENEURSHIP_NEGATIVE_SIGNALS),
  ];
  if (
    negatives.some((n) =>
      ["مشروع مادة", "نشاط صفي", "class project", "school project"].includes(n)
    ) &&
    containsAny(corpus, ["متجر", "shop", "store"]).length > 0
  ) {
    return null;
  }

  const generalHits = containsAny(corpus, ENTREPRENEURSHIP_KEYWORDS);
  if (generalHits.length === 0) return null;

  let bestEnt: { slug: string; weight: number } | null = null;
  for (const e of ENT_EVENT_BY_KEYWORD) {
    const hits = containsAny(corpus, e.patterns);
    if (hits.length === 0) continue;
    const w = e.weight + hits.length * 3;
    if (!bestEnt || w > bestEnt.weight) bestEnt = { slug: e.slug, weight: w };
  }

  const matchedSignals = [
    `business_keywords:${generalHits.slice(0, 4).join(",")}`,
    ...(bestEnt ? [`business_type:${bestEnt.slug}`] : []),
  ];

  const score = generalHits.length * 8 + (bestEnt?.weight ?? 6);
  const reasons = [...matchedSignals];
  const confidence = scoreToConfidence(score, generalHits.length + (bestEnt ? 1 : 0));
  if (confidence === "low") return null;

  const entRow = ENTREPRENEURSHIP_EVENT_OPTIONS.find((o) => o.value === bestEnt?.slug);

  let result: LegacyClassificationResult = {
    category: UI_CATEGORY_ENTREPRENEURSHIP,
    confidence,
    score,
    reasons,
    matchedSignals,
    negativeSignals: negatives,
    entrepreneurshipEventSlug: bestEnt?.slug ?? "ent_shop",
    businessTypeHint: entRow?.ar ?? bestEnt?.slug,
  };

  return applyNegativePenalty(result, negatives, 16);
};

export const inferTrainingCourseFromLegacy = (
  input: LegacyAchievementInput
): LegacyClassificationResult | null => {
  const corpus = buildLegacySearchCorpus(input);
  if (!corpus) return null;

  const trainingHits = containsAny(corpus, TRAINING_KEYWORDS);
  if (trainingHits.length === 0) return null;

  const onlineHits = containsAny(corpus, TRAINING_ONLINE_KEYWORDS);
  const inPersonHits = containsAny(corpus, TRAINING_IN_PERSON_KEYWORDS);
  let mode: typeof TRAINING_MODE_IN_PERSON | typeof TRAINING_MODE_ONLINE =
    TRAINING_MODE_IN_PERSON;
  if (onlineHits.length > inPersonHits.length) mode = TRAINING_MODE_ONLINE;
  else if (onlineHits.length === 0 && inPersonHits.length === 0) {
    if (/\bonline\b|عن بعد|اونلاين/.test(corpus)) mode = TRAINING_MODE_ONLINE;
  }

  const hours = extractTrainingHours(corpus);
  const titleSource = String(
    input.customAchievementName ||
      input.title ||
      input.nameAr ||
      input.nameEn ||
      input.achievementName ||
      ""
  ).trim();
  const courseField = inferTrainingCourseField(titleSource);

  let score = trainingHits.length * 10 + (hours ? 12 : 0) + (onlineHits.length || inPersonHits.length ? 6 : 0);
  const reasons = [`training_keywords:${trainingHits.slice(0, 4).join(",")}`];
  if (hours) reasons.push(`training_hours:${hours}`);
  reasons.push(`training_mode:${mode}`);
  if (courseField) reasons.push(`inferred_field:${courseField}`);

  const matchedSignals = [...reasons];
  const negatives = [
    ...collectNegativeHits(corpus, GLOBAL_NEGATIVE_SIGNALS),
    ...collectNegativeHits(corpus, TRAINING_NEGATIVE_SIGNALS),
  ];

  const confidence = scoreToConfidence(score, trainingHits.length + (hours ? 1 : 0));
  if (confidence === "low") return null;

  let result: LegacyClassificationResult = {
    category: UI_CATEGORY_TRAINING_COURSES,
    confidence,
    score,
    reasons,
    matchedSignals,
    negativeSignals: negatives,
    trainingMode: mode,
    trainingHours: hours,
    trainingCourseTitle: titleSource.length > 2 && !PROGRAM_NAME_SLUGS.has(titleSource) ? titleSource : undefined,
    trainingField: courseField ?? undefined,
  };

  return applyNegativePenalty(result, negatives, 14);
};

export const inferAchievementCategoryFromLegacyData = (
  input: LegacyAchievementInput
): LegacyClassificationResult | null => {
  const candidates = [
    inferUniversityAdmission(input),
    inferEntrepreneurship(input),
    inferTrainingCourseFromLegacy(input),
  ].filter((c): c is LegacyClassificationResult => c != null);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  const second = candidates[1];

  if (second && top.score - second.score < 8 && top.confidence !== "high") {
    return { ...top, confidence: "medium", reasons: [...top.reasons, "competing_category_reduced_confidence"] };
  }

  return top;
};

export const isAlreadySpecialCategory = (input: LegacyAchievementInput): boolean => {
  const cat = String(input.achievementCategory || "").trim();
  if (SPECIAL_CATEGORIES.has(cat)) return true;

  return Boolean(
    inferUiCategoryFromStoredAchievement({
      achievementType: String(input.achievementType || ""),
      achievementName: input.achievementName,
      achievementCategory: cat,
      description: input.description,
    })
  );
};

export const isEligibleForLegacyBackfill = (input: LegacyAchievementInput): boolean => {
  if (isAlreadySpecialCategory(input)) return false;
  const type = String(input.achievementType || "").trim();
  if (SKIP_ACHIEVEMENT_TYPES.has(type)) return false;
  if (type !== "program" && type !== "other") return false;
  return true;
};

export const shouldApplyLegacyClassification = (
  result: LegacyClassificationResult | null
): boolean => {
  if (!result?.category) return false;
  if (result.confidence === "high") return true;
  if (result.confidence === "medium" && result.reasons.length >= 2 && result.score >= 50) {
    return true;
  }
  return false;
};

export const classifyLegacyAchievement = (
  input: LegacyAchievementInput
): LegacyClassificationResult | null => {
  if (!isEligibleForLegacyBackfill(input)) return null;
  return inferAchievementCategoryFromLegacyData(input);
};

const snapshotPreviousValues = (input: LegacyAchievementInput) => ({
  achievementCategory: String(input.achievementCategory || "").trim() || null,
  achievementName: String(input.achievementName || "").trim() || null,
  customAchievementName: String(input.customAchievementName || "").trim() || null,
  achievementLevel: String(input.achievementLevel || "").trim() || null,
  participationType: String(input.participationType || "").trim() || null,
  resultType: String(input.resultType || "").trim() || null,
  resultValue: String(input.resultValue || "").trim() || null,
  nominationText: String(input.nominationText || "").trim() || null,
  inferredField: String(input.inferredField || "").trim() || null,
});

const mergeExtractedMeta = (
  existing: Record<string, unknown> | null | undefined,
  classification: LegacyClassificationResult,
  input: LegacyAchievementInput,
  patch: LegacyBackfillPatch
): Record<string, unknown> => {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};
  const previousCategory = String(input.achievementCategory || "");
  return {
    ...base,
    legacyCategoryBackfill: {
      version: 2,
      classifierVersion: CLASSIFIER_VERSION,
      appliedAt: new Date().toISOString(),
      previousAchievementCategory: previousCategory || null,
      previousValues: snapshotPreviousValues(input),
      suggestedCategory: classification.category,
      confidence: classification.confidence,
      score: classification.score,
      reasons: classification.reasons,
      matchedSignals: classification.matchedSignals,
      negativeSignals: classification.negativeSignals,
      appliedPatchKeys: Object.keys(patch).filter((k) => k !== "evidenceExtractedData"),
      universitySlug: classification.universitySlug ?? null,
      trainingMode: classification.trainingMode ?? null,
      trainingHours: classification.trainingHours ?? null,
      entrepreneurshipEventSlug: classification.entrepreneurshipEventSlug ?? null,
    },
  };
};

export const getBackfillProtectionFlags = (
  input: LegacyAchievementInput
): AchievementBackfillProtectionFlags => resolveBackfillProtectionFlags(input);

/**
 * Non-destructive Mongo $set patch: only fills empty fields; never clears achievementName text.
 */
export const buildLegacyBackfillPatch = (
  input: LegacyAchievementInput,
  classification: LegacyClassificationResult
): LegacyBackfillPatch | null => {
  if (!classification.category || !shouldApplyLegacyClassification(classification)) {
    return null;
  }

  const protectNames = isManuallyProtectedAchievement(getBackfillProtectionFlags(input));

  const patch: LegacyBackfillPatch = {
    achievementCategory: classification.category,
  };

  if (classification.category === UI_CATEGORY_EARLY_UNIVERSITY) {
    const uniSlug =
      classification.universitySlug ||
      String(input.achievementName || "").trim();
    const resolvedLevel = resolveUniversityAchievementLevel({
      universitySlug: uniSlug,
      customUniversityName: input.customAchievementName,
      corpusText: buildLegacySearchCorpus(input),
    });
    const currentLevel = String(input.achievementLevel || "").trim();
    const slugConfirmed = isConfirmedUniversitySlug(uniSlug);
    const mayCorrectExisting =
      classification.confidence === "high" &&
      slugConfirmed &&
      currentLevel === "kingdom" &&
      resolvedLevel === "international";

    if (!currentLevel || mayCorrectExisting) {
      patch.achievementLevel = resolvedLevel;
    }
    if (!String(input.participationType || "").trim()) patch.participationType = "individual";
    if (!String(input.resultType || "").trim()) patch.resultType = "nomination";

    const nameBlank = !String(input.achievementName || "").trim();
    const nameGeneric =
      String(input.achievementName || "") === "other" ||
      PROGRAM_NAME_SLUGS.has(String(input.achievementName || ""));

    if (
      !protectNames &&
      classification.universitySlug &&
      (nameBlank || nameGeneric)
    ) {
      patch.achievementName = classification.universitySlug;
    }

    if (!protectNames && !String(input.customAchievementName || "").trim() && classification.universityLabel) {
      const currentName = String(input.achievementName || "").trim();
      if (
        currentName &&
        currentName !== classification.universitySlug &&
        !PROGRAM_NAME_SLUGS.has(currentName)
      ) {
        patch.customAchievementName = currentName;
      }
    }
  }

  if (classification.category === UI_CATEGORY_TRAINING_COURSES) {
    if (!String(input.achievementLevel || "").trim()) patch.achievementLevel = "province";
    if (!String(input.participationType || "").trim()) patch.participationType = "individual";
    if (!String(input.resultType || "").trim()) patch.resultType = "participation";

    const currentName = String(input.achievementName || "").trim();
    if (
      !protectNames &&
      classification.trainingMode &&
      (!currentName || PROGRAM_NAME_SLUGS.has(currentName))
    ) {
      patch.achievementName = classification.trainingMode;
    }

    if (classification.trainingHours && !String(input.resultValue || "").trim()) {
      patch.resultValue = classification.trainingHours;
    }

    if (
      !protectNames &&
      classification.trainingCourseTitle &&
      !String(input.customAchievementName || "").trim()
    ) {
      if (!currentName || currentName === classification.trainingMode) {
        patch.customAchievementName = classification.trainingCourseTitle;
      } else if (PROGRAM_NAME_SLUGS.has(currentName)) {
        patch.customAchievementName = classification.trainingCourseTitle;
      }
    }

    if (classification.trainingField && !String(input.inferredField || "").trim()) {
      patch.inferredField = classification.trainingField;
    }
  }

  if (classification.category === UI_CATEGORY_ENTREPRENEURSHIP) {
    if (!String(input.achievementLevel || "").trim()) patch.achievementLevel = "province";
    if (!String(input.participationType || "").trim()) patch.participationType = "individual";
    if (!String(input.resultType || "").trim()) patch.resultType = "participation";

    const currentName = String(input.achievementName || "").trim();
    if (
      !protectNames &&
      classification.entrepreneurshipEventSlug &&
      (!currentName || currentName === "other" || !currentName.startsWith("ent_"))
    ) {
      patch.achievementName = classification.entrepreneurshipEventSlug;
    }
  }

  patch.evidenceExtractedData = mergeExtractedMeta(
    input.evidenceExtractedData,
    classification,
    input,
    patch
  );

  return patch;
};

export type LegacyBackfillPreview = {
  classifierVersion: string;
  eligible: boolean;
  protected: boolean;
  protectionFlags: AchievementBackfillProtectionFlags;
  wouldApply: boolean;
  current: {
    achievementCategory: string;
    achievementName: string;
    customAchievementName: string;
    achievementLevel: string;
  };
  proposed: {
    achievementCategory: string;
    achievementLevel?: string;
    achievementName?: string;
    customAchievementName?: string;
    patchKeys: string[];
  } | null;
  classification: LegacyClassificationResult | null;
};

/** Read-only preview (no DB writes). */
export const buildLegacyBackfillPreview = (
  input: LegacyAchievementInput
): LegacyBackfillPreview => {
  const protectionFlags = getBackfillProtectionFlags(input);
  const eligible = isEligibleForLegacyBackfill(input);
  const classification = eligible
    ? classifyLegacyAchievement(input)
    : inferAchievementCategoryFromLegacyData(input);
  const patch = classification
    ? buildLegacyBackfillPatch(input, classification)
    : null;

  return {
    classifierVersion: CLASSIFIER_VERSION,
    eligible,
    protected: isManuallyProtectedAchievement(protectionFlags),
    protectionFlags,
    wouldApply: Boolean(patch),
    current: {
      achievementCategory: String(input.achievementCategory || ""),
      achievementName: String(input.achievementName || ""),
      customAchievementName: String(input.customAchievementName || ""),
      achievementLevel: String(input.achievementLevel || ""),
    },
    proposed: patch
      ? {
          achievementCategory: patch.achievementCategory,
          achievementLevel: patch.achievementLevel,
          achievementName: patch.achievementName,
          customAchievementName: patch.customAchievementName,
          patchKeys: Object.keys(patch).filter((k) => k !== "evidenceExtractedData"),
        }
      : null,
    classification,
  };
};

/**
 * Corrects achievementLevel for existing early-university rows (e.g. international uni stored as kingdom).
 * Non-destructive: only adjusts level when rules allow.
 */
export const buildEarlyUniversityLevelCorrectionPatch = (
  input: LegacyAchievementInput
): Pick<LegacyBackfillPatch, "achievementLevel" | "evidenceExtractedData"> | null => {
  const cat = String(input.achievementCategory || "").trim();
  const name = String(input.achievementName || "").trim();
  const isEarly =
    cat === UI_CATEGORY_EARLY_UNIVERSITY ||
    EARLY_UNIVERSITY_EVENT_VALUES.has(name);
  if (!isEarly) return null;

  const uniSlug = name || "";
  const resolvedLevel = resolveUniversityAchievementLevel({
    universitySlug: uniSlug,
    customUniversityName: input.customAchievementName,
    corpusText: buildLegacySearchCorpus(input),
  });
  const currentLevel = String(input.achievementLevel || "").trim();
  if (!currentLevel) {
    return {
      achievementLevel: resolvedLevel,
      evidenceExtractedData: mergeExtractedMetaForLevelFix(
        input.evidenceExtractedData,
        resolvedLevel,
        currentLevel,
        uniSlug
      ),
    };
  }

  const slugConfirmed = isConfirmedUniversitySlug(uniSlug);
  if (
    slugConfirmed &&
    currentLevel === "kingdom" &&
    resolvedLevel === "international"
  ) {
    return {
      achievementLevel: resolvedLevel,
      evidenceExtractedData: mergeExtractedMetaForLevelFix(
        input.evidenceExtractedData,
        resolvedLevel,
        currentLevel,
        uniSlug
      ),
    };
  }

  return null;
};

const mergeExtractedMetaForLevelFix = (
  existing: Record<string, unknown> | null | undefined,
  newLevel: string,
  previousLevel: string,
  universitySlug: string
): Record<string, unknown> => {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};
  return {
    ...base,
    legacyUniversityLevelFix: {
      version: 2,
      classifierVersion: CLASSIFIER_VERSION,
      appliedAt: new Date().toISOString(),
      previousAchievementLevel: previousLevel || null,
      achievementLevel: newLevel,
      universitySlug,
    },
  };
};
