/**
 * Central eligibility + input text for student AI field inference (other + selected structured types).
 * Server and client share this module — do not import browser-only APIs here.
 *
 * Structured channels (program / excellence_program / qudrat / mawhiba_annual) call AI only when
 * `inferAchievementField` still yields `other` — fixed mappings from `achievement-field-inference`
 * skip AI. Extend explicit slug lists below if you need exceptions.
 */

import {
  OLYMPIAD_EVENT_OTHER_VALUE,
  getEventOptionsForUiCategory,
  mapUiCategoryToDbAchievementType,
} from "@/constants/achievement-ui-categories";
import { MAWHIBA_ANNUAL_SUBJECTS } from "@/constants/achievement-options";
import { inferAchievementField } from "@/lib/achievement-field-inference";

/** Optional: program event slugs that must always use AI (override rule engine). Currently unused. */
export const PROGRAM_AI_FIELD_EVENT_SLUGS = [] as const;

/** Optional: excellence program slugs that must always use AI. Currently unused. */
export const EXCELLENCE_AI_FIELD_EVENT_SLUGS = [] as const;

export type AiFieldInferenceLocale = "ar" | "en";

export type AiFieldInferenceContext = {
  userRole: string;
  uiCategory: string;
  /** DB achievement type (e.g. mawhiba_annual, qudrat). */
  achievementType: string;
  achievementName: string;
  customAchievementName: string;
  olympiadField: string;
  mawhibaAnnualSubject: string;
  description: string;
  /** Resolved display/event name used by rule inference when known. */
  finalAchievementName?: string;
  locale: AiFieldInferenceLocale;
};

const trim = (s: string) => String(s ?? "").trim();

const MAX_INFERENCE_CHARS = 500;

/** Shapes where the student might be in an AI-eligible flow (used for clearing override when leaving). */
export const isAiFieldInferenceEligibleShape = (ctx: AiFieldInferenceContext): boolean => {
  if (ctx.userRole !== "student") return false;
  const ui = trim(ctx.uiCategory);
  const name = trim(ctx.achievementName);
  const type = trim(ctx.achievementType);
  const custom = trim(ctx.customAchievementName);
  const subj = trim(ctx.mawhibaAnnualSubject);

  if (ui === "other" || name === "other" || name === OLYMPIAD_EVENT_OTHER_VALUE) return true;
  if (type === "program" && name) return true;
  if (type === "excellence_program" && name) return true;
  if (type === "qudrat" && name) return true;
  if (type === "mawhiba_annual" && name && subj) return true;
  return false;
};

/** Legacy “Other” paths: custom / olympiad-other title must be non-empty to call AI. */
export const isLegacyOtherAiEligible = (ctx: AiFieldInferenceContext): boolean => {
  const custom = trim(ctx.customAchievementName);
  if (!custom) return false;
  const ui = trim(ctx.uiCategory);
  const name = trim(ctx.achievementName);
  return ui === "other" || name === "other" || name === OLYMPIAD_EVENT_OTHER_VALUE;
};

/** Structured types that may use AI when rule engine still yields `other`. */
export const isStructuredAiInferenceChannel = (ctx: AiFieldInferenceContext): boolean => {
  const type = trim(ctx.achievementType);
  const name = trim(ctx.achievementName);
  const subj = trim(ctx.mawhibaAnnualSubject);
  if (type === "program" && name) return true;
  if (type === "excellence_program" && name) return true;
  if (type === "qudrat" && name) return true;
  if (type === "mawhiba_annual" && name && subj) return true;
  return false;
};

const subjectLabel = (slug: string, loc: AiFieldInferenceLocale): string => {
  const row = MAWHIBA_ANNUAL_SUBJECTS.find((s) => s.value === slug);
  if (!row) return slug;
  return loc === "ar" ? row.ar : row.en;
};

/**
 * Best-effort human label for the selected event/rank row (slug-based, no raw Arabic literals in logic).
 */
const resolveEventOrRankLabel = (
  uiCategory: string,
  achievementName: string,
  loc: AiFieldInferenceLocale
): string => {
  const opts = getEventOptionsForUiCategory(uiCategory, loc);
  const hit = opts.find((o) => o.value === achievementName);
  return hit?.label?.trim() || "";
};

/**
 * Semantic text sent to the model. Never empty when eligibility is true in normal UI.
 */
export const buildFieldInferenceInput = (ctx: AiFieldInferenceContext): string => {
  const custom = trim(ctx.customAchievementName);
  const desc = trim(ctx.description);
  const ui = trim(ctx.uiCategory);
  const loc = ctx.locale === "en" ? "en" : "ar";

  const parts: string[] = [];

  if (isLegacyOtherAiEligible(ctx)) {
    if (custom) parts.push(custom);
  } else {
    if (custom) parts.push(custom);
    const eventLabel = resolveEventOrRankLabel(ui, trim(ctx.achievementName), loc);
    if (eventLabel) parts.push(eventLabel);
    if (trim(ctx.achievementType) === "mawhiba_annual" && trim(ctx.mawhibaAnnualSubject)) {
      const sl = subjectLabel(trim(ctx.mawhibaAnnualSubject), loc);
      if (sl) parts.push(sl);
    }
  }

  if (desc) parts.push(desc);

  const merged = parts
    .filter(Boolean)
    .join(" — ")
    .replace(/\s+/g, " ")
    .trim();

  if (merged.length <= MAX_INFERENCE_CHARS) return merged;
  return `${merged.slice(0, MAX_INFERENCE_CHARS)}…`;
};

export const runRuleInferenceForAiGate = (ctx: AiFieldInferenceContext) => {
  const finalName = trim(ctx.finalAchievementName ?? "") || trim(ctx.achievementName);
  return inferAchievementField(
    trim(ctx.achievementType),
    finalName || undefined,
    trim(ctx.olympiadField),
    trim(ctx.mawhibaAnnualSubject),
    `${trim(ctx.customAchievementName)} ${trim(ctx.description)}`
  );
};

/**
 * Whether the student session should call the AI field endpoint (debounced on the client).
 */
export const shouldUseAiFieldInference = (ctx: AiFieldInferenceContext): boolean => {
  if (ctx.userRole !== "student") return false;

  const text = buildFieldInferenceInput(ctx);
  if (!text) return false;

  if (isLegacyOtherAiEligible(ctx)) return true;

  if (!isStructuredAiInferenceChannel(ctx)) return false;

  const inferred = runRuleInferenceForAiGate(ctx);
  return inferred.field === "other";
};

/** Resolve DB type when client omitted it (backward compatible with older POST bodies). */
export const resolveAchievementTypeForAiApi = (
  uiCategory: string,
  bodyAchievementType?: string | null
): string => {
  const fromBody = trim(String(bodyAchievementType ?? ""));
  if (fromBody) return fromBody;
  return mapUiCategoryToDbAchievementType(trim(uiCategory));
};

/**
 * Build API-side context from JSON body (student-only action — caller must enforce auth).
 */
export const aiFieldInferenceContextFromApiBody = (
  body: Record<string, unknown>,
  locale: AiFieldInferenceLocale
): AiFieldInferenceContext => {
  const achievementCategory = trim(String(body.achievementCategory ?? ""));
  const achievementType = resolveAchievementTypeForAiApi(
    achievementCategory,
    body.achievementType as string | undefined
  );
  const achievementName = trim(String(body.achievementName ?? ""));
  const customFromField = trim(String(body.customAchievementName ?? ""));
  const customFromLegacy = trim(String(body.customEventName ?? ""));
  const customAchievementName =
    customFromField || (isLegacyOtherShapeFromParts(achievementCategory, achievementName) ? customFromLegacy : "");

  return {
    userRole: "student",
    uiCategory: achievementCategory,
    achievementType,
    achievementName,
    customAchievementName,
    olympiadField: trim(String(body.olympiadField ?? "")),
    mawhibaAnnualSubject: trim(String(body.mawhibaAnnualSubject ?? "")),
    description: trim(String(body.description ?? "")),
    finalAchievementName: trim(String(body.finalAchievementName ?? "")) || undefined,
    locale,
  };
};

const isLegacyOtherShapeFromParts = (uiCategory: string, achievementName: string): boolean => {
  const ui = trim(uiCategory);
  const name = trim(achievementName);
  return ui === "other" || name === "other" || name === OLYMPIAD_EVENT_OTHER_VALUE;
};

export const shouldUseAiFieldInferenceForApiBody = (
  body: Record<string, unknown>,
  locale: AiFieldInferenceLocale
): boolean => shouldUseAiFieldInference(aiFieldInferenceContextFromApiBody(body, locale));

export const buildFieldInferenceInputForApiBody = (
  body: Record<string, unknown>,
  locale: AiFieldInferenceLocale
): string => buildFieldInferenceInput(aiFieldInferenceContextFromApiBody(body, locale));
