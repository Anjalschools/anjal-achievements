/**
 * User-facing (AR/EN) messages for letter-request OpenAI flows.
 * Keeps raw technical strings off the admin UI where possible.
 */

export type LetterOpenAiFailureCode =
  | "ai_disabled"
  | "config"
  | "http"
  | "parse"
  | "empty"
  | "timeout"
  | "letter_body_missing"
  | "unknown";

/** Stable API-facing codes for admin letter AI (generate / regenerate / refine). */
export type LetterAiPublicErrorCode = "AI_NOT_CONFIGURED" | "AI_UNAVAILABLE" | "AI_GENERATION_FAILED";

export const mapLetterAiInternalCodeToPublicCode = (internal: string): LetterAiPublicErrorCode => {
  const c = internal as LetterOpenAiFailureCode;
  if (c === "ai_disabled" || c === "config") return "AI_NOT_CONFIGURED";
  if (c === "http" || c === "timeout") return "AI_UNAVAILABLE";
  return "AI_GENERATION_FAILED";
};

export const letterAiPublicCodeToHttpStatus = (code: LetterAiPublicErrorCode): number =>
  code === "AI_NOT_CONFIGURED" ? 503 : 502;

export const mapLetterOpenAiFailureToUserMessages = (
  code: string,
  technicalFallback: string
): { ar: string; en: string } => {
  const c = code as LetterOpenAiFailureCode;
  switch (c) {
    case "ai_disabled":
      return {
        ar: "ميزة المساعدة الذكية غير مفعّلة أو مفتاح OpenAI غير مهيّأ. تحقق من OPENAI_API_KEY ومن عدم تعطيل AI_ASSIST_ENABLED.",
        en: "AI assist is disabled or not configured. Check OPENAI_API_KEY and AI_ASSIST_ENABLED (same settings as certificate attachment review).",
      };
    case "config":
      return {
        ar: "لم يُعثَر على مفتاح OpenAI في إعدادات الخادم. أضف OPENAI_API_KEY إلى بيئة التشغيل كما في مراجعة الشهادات.",
        en: "OpenAI API key is missing on the server. Set OPENAI_API_KEY (same as certificate AI review).",
      };
    case "timeout":
      return {
        ar: "انتهت مهلة الاتصال بخدمة الذكاء الاصطناعي. حاول مرة أخرى.",
        en: "The AI request timed out. Please try again.",
      };
    case "parse":
      return {
        ar: "استجابة غير متوقعة من نموذج الذكاء الاصطناعي. أعد المحاولة أو اكتب المسودة يدوياً.",
        en: "Unexpected AI response format. Retry or draft manually.",
      };
    case "empty":
    case "letter_body_missing":
      return {
        ar: "لم يُرجع النموذج نصاً صالحاً للخطاب. أعد المحاولة أو عدّل المدخلات.",
        en: "The model did not return usable letter text. Retry or edit manually.",
      };
    case "http":
      return {
        ar: "تعذّر الاتصال بخدمة OpenAI. تحقق من الشبكة أو المفتاح ثم أعد المحاولة.",
        en: "Could not reach OpenAI. Check connectivity and API key, then retry.",
      };
    default:
      return {
        ar: technicalFallback
          ? `تعذّر إنشاء المسودة: ${technicalFallback}`
          : "تعذّر إنشاء المسودة. حاول مجدداً أو اكتب النص يدوياً.",
        en: technicalFallback || "Could not generate a draft. Try again or type the letter manually.",
      };
  }
};
