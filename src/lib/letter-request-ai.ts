import { openAiChatJsonObject } from "@/lib/openai-server";
import type { LetterRequestLanguage, LetterRequestType, LetterRequestedAuthorRole } from "@/lib/letter-request-types";

export type LetterAiAction = "generate" | "regenerate" | "refine";

const typeHint = (t: LetterRequestType, lang: LetterRequestLanguage): string => {
  if (lang === "ar") {
    return t === "testimonial"
      ? "إفادة رسمية تقريرية تثبت الحقائق المذكورة فقط، دون مبالغة."
      : "خطاب توصية رسمي تزكوي بحدود ما يدعمه النص المرجعي فقط.";
  }
  return t === "testimonial"
    ? "A formal attestation-style letter stating only supported facts, no exaggeration."
    : "A formal recommendation letter endorsing the student only within what the reference text supports.";
};

const authorHint = (r: LetterRequestedAuthorRole, lang: LetterRequestLanguage): string => {
  if (lang === "ar") {
    if (r === "teacher") return "صيغة موقعة من معلم / جهة تعليمية.";
    if (r === "supervisor") return "صيغة موقعة من مشرف.";
    return "صيغة موقعة من إدارة المدرسة.";
  }
  if (r === "teacher") return "Wording suitable for a teacher signatory.";
  if (r === "supervisor") return "Wording suitable for a supervisor signatory.";
  return "Wording suitable for school administration.";
};

export const generateLetterAiDraft = async (input: {
  action: LetterAiAction;
  requestType: LetterRequestType;
  language: LetterRequestLanguage;
  targetOrganization: string;
  requestBody: string;
  requestedAuthorRole: LetterRequestedAuthorRole;
  requestedSpecialization?: string;
  studentName: string;
  studentMeta: string;
  achievementsSummary: string;
  currentDraft?: string;
}): Promise<
  | { ok: true; text: string }
  | { ok: false; code: string; message: string }
> => {
  const lang = input.language;
  const sys =
    lang === "ar"
      ? `أنت مساعد لكتابة مراسلات رسمية مدرسية باللغة العربية الفصحى الرسمية.
قواعد صارمة:
- لا تخترع إنجازات أو حقائق غير واردة في المدخلات.
- إذا نقصت التفاصيل، استخدم صياغة عامة محايدة دون ادعاءات جديدة.
- لا تذكر درجات أو جوائز غير مذكورة صراحة في الملخص.
- المخرجات: JSON فقط بالشكل {"letterBody":"..."} حيث letterBody هو النص الكامل للخطاب بفقرات واضحة.`
      : `You draft formal school correspondence in professional English.
Strict rules:
- Do not invent achievements or facts not present in the inputs.
- If details are missing, use neutral general wording without new claims.
- Do not mention grades or awards unless explicitly listed in the summary.
- Output JSON only: {"letterBody":"..."} with the full letter body in clear paragraphs.`;

  const actionLine =
    input.action === "refine"
      ? lang === "ar"
        ? "حسّن الصياغة الرسمية للنص التالي دون إضافة معلومات جديدة."
        : "Polish the following draft for formal tone without adding new factual claims."
      : input.action === "regenerate"
        ? lang === "ar"
          ? "أعد صياغة الخطاب بالكامل بنفس القيود."
          : "Rewrite the full letter with the same constraints."
        : lang === "ar"
          ? "اكتب مسودة خطاب كاملة."
          : "Write a complete letter draft.";

  const userObj = {
    actionLine,
    requestType: input.requestType,
    language: input.language,
    targetOrganization: input.targetOrganization,
    studentProvidedReference: input.requestBody,
    intendedRecipientOrganization: input.targetOrganization,
    signatoryPerspective: input.requestedAuthorRole,
    specialization: input.requestedSpecialization || null,
    studentDisplayName: input.studentName,
    studentRecordSummary: input.studentMeta,
    approvedAchievementsSummary: input.achievementsSummary,
    styleNotes: [typeHint(input.requestType, lang), authorHint(input.requestedAuthorRole, lang)],
    currentDraftToRefine: input.action === "refine" ? input.currentDraft || "" : undefined,
  };

  const res = await openAiChatJsonObject({
    system: sys,
    user: JSON.stringify(userObj),
    maxTokens: 2200,
    temperature: input.action === "refine" ? 0.15 : 0.35,
    /** Same order of magnitude as attachment AI vision calls (`openai-vision-json`). */
    timeoutMs: 55_000,
  });

  if (!res.ok) {
    return { ok: false, code: res.code, message: res.message };
  }
  const parsed = res.parsed as { letterBody?: string };
  const text = typeof parsed?.letterBody === "string" ? parsed.letterBody.trim() : "";
  if (!text) {
    return { ok: false, code: "letter_body_missing", message: "Model returned empty letterBody" };
  }
  return { ok: true, text };
};
