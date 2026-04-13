/**
 * Pure preview helpers (client-safe — no DB / Mongoose).
 */
import type { LetterRequestLanguage, LetterRequestType } from "@/lib/letter-request-types";

export type LetterPreviewSource = "final" | "ai" | "reference" | "none";

export type LetterPreviewContext = {
  language: LetterRequestLanguage;
  requestType: LetterRequestType;
  targetOrganization: string;
  studentDisplayName: string;
};

/** Prefer final → AI draft → formatted student reference. */
export const buildLetterPreviewDisplay = (
  finalApprovedText: string | undefined,
  aiDraftText: string | undefined,
  requestBody: string | undefined,
  ctx: LetterPreviewContext
): { bodyText: string; source: LetterPreviewSource } => {
  const f = (finalApprovedText || "").trim();
  if (f) return { bodyText: f, source: "final" };
  const a = (aiDraftText || "").trim();
  if (a) return { bodyText: a, source: "ai" };
  const r = (requestBody || "").trim();
  if (r) {
    const typeAr = ctx.requestType === "testimonial" ? "إفادة" : "خطاب توصية";
    const typeEn = ctx.requestType === "testimonial" ? "Testimonial" : "Recommendation letter";
    const intro =
      ctx.language === "ar"
        ? `معاينة أولية غير معتمدة\nالجهة الموجَّه لها: ${ctx.targetOrganization}\nاسم الطالب: ${ctx.studentDisplayName}\nنوع الطلب: ${typeAr}\n\nالنص المرجعي الذي قدّمه الطالب:\n\n`
        : `Draft preview (not approved)\nTo: ${ctx.targetOrganization}\nStudent: ${ctx.studentDisplayName}\nRequest type: ${typeEn}\n\nReference text from the student:\n\n`;
    return { bodyText: `${intro}${r}`, source: "reference" };
  }
  return { bodyText: "", source: "none" };
};
