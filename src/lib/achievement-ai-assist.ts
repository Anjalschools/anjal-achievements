/**
 * Achievement AI assist (server-only).
 * Student field suggestion: custom "Other" paths + eligible program / Qudrat / Mawhiba channels
 * (see `achievement-ai-field-eligibility` + `/api/ai/assist` guards).
 * Reviewer: optional revision-note drafts.
 */

import { ALLOWED_INFERRED_FIELD_VALUES, clampInferredFieldToAllowlist } from "@/lib/achievement-inferred-field-allowlist";
import { openAiChatJsonObject } from "@/lib/openai-server";

const truncate = (s: string, max: number): string => {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
};

const stripDataUrls = (s: string): string => s.replace(/data:[^\s]+/gi, "[omitted]");

const pickString = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
};

const pickNumber = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return Math.min(1, Math.max(0, v));
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.min(1, Math.max(0, n));
  }
  return null;
};

export type AiOtherFieldAssistPayload = {
  locale: "ar" | "en";
  /** Custom event / program / competition name (typed by student) */
  customEventName: string;
};

export type AiOtherFieldAssistResult = {
  suggestedField: string | null;
  confidence: number | null;
  noteAr: string;
  noteEn: string;
};

export type AiReviewerNotesResponse = {
  draftAr: string;
  draftEn: string;
};

const ALLOWED_FIELDS_PROMPT = [...ALLOWED_INFERRED_FIELD_VALUES].sort().join(", ");

export const runAiOtherCustomFieldAssist = async (
  payload: AiOtherFieldAssistPayload
): Promise<{ ok: true; data: AiOtherFieldAssistResult } | { ok: false; message: string }> => {
  const locale = payload.locale === "en" ? "en" : "ar";
  const name = truncate(stripDataUrls(payload.customEventName), 500);

  const system = `You suggest ONE academic/domain field label for a student achievement platform.
Output a single JSON object only (no markdown).

Rules:
- suggestedField must be exactly one of these allowed values (lowercase snake_case if multi-word): ${ALLOWED_FIELDS_PROMPT}
- If you cannot map confidently, set suggestedField to null
- confidence: number from 0 to 1, or null if no suggestion
- noteAr: one short Arabic sentence explaining the suggestion (or that no suggestion was made)
- noteEn: one short English sentence
- You NEVER approve achievements or mention submission success.`;

  const user = `Custom event/activity name (${locale} context):\n${JSON.stringify(name)}`;

  const result = await openAiChatJsonObject({
    system,
    user,
    maxTokens: 350,
    temperature: 0.1,
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const o = result.parsed && typeof result.parsed === "object" ? (result.parsed as Record<string, unknown>) : {};
  const rawField = pickString(o.suggestedField);
  const suggestedField = rawField ? clampInferredFieldToAllowlist(rawField) : null;
  const confidence = pickNumber(o.confidence);

  const noteAr =
    pickString(o.noteAr) ||
    (locale === "ar"
      ? suggestedField
        ? "تم اقتراح المجال بناءً على الاسم المدخل."
        : "لم يُستطع اقتراح مجال ضمن القائمة المعتمدة."
      : suggestedField
        ? "تم اقتراح المجال بناءً على الاسم المدخل."
        : "لم يُستطع اقتراح مجال ضمن القائمة المعتمدة.");

  const noteEn =
    pickString(o.noteEn) ||
    (suggestedField
      ? "Field was suggested based on the entered custom name."
      : "No field could be suggested within the approved list.");

  return {
    ok: true,
    data: {
      suggestedField,
      confidence: suggestedField ? confidence : null,
      noteAr,
      noteEn,
    },
  };
};

const sanitizeReviewerNotes = (parsed: unknown): AiReviewerNotesResponse => {
  const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const draftAr = pickString(o.draftAr) || pickString(o.notesAr) || "";
  const draftEn = pickString(o.draftEn) || pickString(o.notesEn) || "";
  return {
    draftAr: draftAr || "يرجى مراجعة البيانات وإكمال الحقول الناقصة بوضوح.",
    draftEn: draftEn || "Please review the submission and clearly complete missing fields.",
  };
};

export const runAiReviewerNotes = async (input: {
  locale: "ar" | "en";
  achievementJson: Record<string, unknown>;
}): Promise<{ ok: true; data: AiReviewerNotesResponse } | { ok: false; message: string }> => {
  const locale = input.locale === "en" ? "en" : "ar";
  const safe = truncate(stripDataUrls(JSON.stringify(input.achievementJson)), 14_000);

  const system = `You draft professional reviewer messages for a school achievements committee.
Return JSON only: { "draftAr": "...", "draftEn": "..." }.
Tone: formal, constructive, specific to missing or inconsistent fields. Do NOT approve or reject — only request clarifications or corrections.
Do NOT invent private student data beyond what is in the payload.
Primary audience language hint: ${locale === "ar" ? "Arabic" : "English"} — but always provide both Arabic and English drafts.`;

  const result = await openAiChatJsonObject({
    system,
    user: `Achievement record (JSON):\n${safe}`,
    maxTokens: 800,
    temperature: 0.25,
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  return { ok: true, data: sanitizeReviewerNotes(result.parsed) };
};
