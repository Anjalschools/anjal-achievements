import type { PublishTarget } from "@/models/NewsPost";

export type QualityIssue = { id: string; ar: string; en: string; blocking: boolean };

export const evaluateNewsQuality = (input: {
  title: string;
  coverImage?: string;
  websiteBody?: string;
  instagramCaption?: string;
  xPostText?: string;
  tiktokCaption?: string;
  snapchatText?: string;
  namesOrEntities?: string;
}, isAr: boolean): QualityIssue[] => {
  const issues: QualityIssue[] = [];
  const L = (id: string, ar: string, en: string, blocking: boolean) =>
    issues.push({ id, ar, en, blocking });

  if (!input.title?.trim()) L("no_title", "لا يوجد عنوان", "Missing title", true);
  if (!input.coverImage?.trim()) L("no_cover", "لا توجد صورة رئيسية", "No cover image", false);
  if (!input.namesOrEntities?.trim())
    L("no_names", "لم تُذكر أسماء أو جهات رئيسية", "No key names or entities", false);
  if (!input.websiteBody?.trim() || input.websiteBody.length < 80)
    L("short_website", "نص الموقع قصير جدًا أو فارغ", "Website body too short or empty", false);

  const hasHook =
    /[!؟?]/.test(input.websiteBody || "") || (input.websiteBody || "").split("\n").length > 2;
  if (input.websiteBody?.trim() && !hasHook)
    L("weak_hook", "قد يفتقر النص إلى افتتاحية جذابة", "Body may lack a strong hook", false);

  if (!/شارك|تابع|اكتشف|سجّل|visit|read more|learn/i.test(input.websiteBody || ""))
    L("no_cta", "لا يوجد دعوة لاتخاذ إجراء واضحة", "No clear call-to-action", false);

  return issues;
};

export const evaluatePlatformBlocking = (
  target: PublishTarget,
  input: { coverImage?: string; instagramCaption?: string; xPostText?: string },
  isAr: boolean
): string[] => {
  const blocking: string[] = [];
  if (target === "instagram") {
    if (!input.coverImage?.trim()) blocking.push(isAr ? "صورة مطلوبة لإنستغرام" : "Image required for Instagram");
    if (!input.instagramCaption?.trim()) blocking.push(isAr ? "نص إنستغرام مطلوب" : "Instagram caption required");
  }
  if (target === "x") {
    if (!input.xPostText?.trim()) blocking.push(isAr ? "نص X مطلوب" : "X post text required");
    if ((input.xPostText || "").length > 280) blocking.push(isAr ? "نص X أطول من 280" : "X text over 280 chars");
  }
  if (target === "tiktok") {
    blocking.push(isAr ? "TikTok يتطلب فيديو — غير جاهز للنشر المباشر" : "TikTok requires video — not ready");
  }
  if (target === "snapchat") {
    blocking.push(isAr ? "سناب شات — نشر مباشر غير مدعوم في هذه المرحلة" : "Snapchat direct publish not supported in this phase");
  }
  return blocking;
};

/** Hard blocks for publishing to the website (not warnings). */
export const blockingForWebsitePublish = (input: { title: string; websiteBody?: string }): string[] => {
  const b: string[] = [];
  if (!input.title?.trim()) b.push("no_title");
  if (!input.websiteBody?.trim() || input.websiteBody.trim().length < 40) b.push("no_body");
  return b;
};

/** Strict gate: title + cover + body — used before any publish action (UI + server). */
export const blockingStrictNewsPublish = (input: {
  title: string;
  websiteBody?: string;
  coverImage?: string;
}): string[] => {
  const b = blockingForWebsitePublish(input);
  if (!input.coverImage?.trim()) b.push("no_cover");
  return [...new Set(b)];
};

export type NewsPublishValidation = { ok: boolean; blocks: string[] };

export const validateNews = (input: {
  title: string;
  websiteBody?: string;
  coverImage?: string;
}): NewsPublishValidation => {
  const blocks = blockingStrictNewsPublish(input);
  return { ok: blocks.length === 0, blocks };
};
