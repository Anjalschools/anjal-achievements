/**
 * Single source of truth for user-visible achievement titles.
 * Never returns raw Latin slugs when a catalogue label exists.
 */

import { isArabicText } from "@/lib/achievementNormalize";
import { isLikelyTechnicalSlug, resolveAchievementEventSlug } from "@/lib/achievementDisplay";
import {
  getAchievementEventOrSlugLabel,
  getAchievementTypeLabel,
  humanizeRawKeyForDisplay,
} from "@/lib/achievement-display-labels";
import { isDisallowedAchievementTitleToken } from "@/lib/achievement-meta-slugs";

export type AchievementTitleLocale = "ar" | "en";

const safeStr = (v: unknown) => String(v ?? "").trim();

/**
 * Resolve a human-readable achievement title for lists, cards, and dashboard rows.
 * Arabic: titleAr → nameAr → event/program fields → type → humanize.
 * English: nameEn → titleEn → title → event fields → type → humanize.
 */
export const resolveAchievementTitle = (
  record: Record<string, unknown>,
  loc: AchievementTitleLocale
): string => {
  const typeKey = safeStr(record.achievementType);

  const resolveCataloguedSlug = (raw: string): string | null => {
    if (!raw) return null;
    const hit = resolveAchievementEventSlug(raw);
    if (hit) return loc === "ar" ? hit.ar : hit.en;
    return null;
  };

  const tryTitleField = (raw: unknown): string | null => {
    const s = safeStr(raw);
    if (!s) return null;
    if (isDisallowedAchievementTitleToken(s)) return null;

    if (isLikelyTechnicalSlug(s)) {
      const fromConstants = resolveCataloguedSlug(s);
      if (fromConstants) return fromConstants;
      const lbl = getAchievementEventOrSlugLabel(s, loc);
      if (lbl && lbl !== "—") return lbl;
      return null;
    }

    if (loc === "ar") {
      if (isArabicText(s)) return s;
      const fromConstants = resolveCataloguedSlug(s);
      if (fromConstants) return fromConstants;
      const lbl = getAchievementEventOrSlugLabel(s, loc);
      if (lbl && lbl !== "—") return lbl;
      return null;
    }

    return s;
  };

  const eventProgramSources: unknown[] = [
    record.achievementName,
    record.customAchievementName,
    record.competitionName,
    record.customCompetitionName,
    record.programName,
    record.customProgramName,
    record.exhibitionName,
    record.customExhibitionName,
    record.olympiadMeeting,
    record.mawhibaAnnualRank,
    record.mawhibaAnnualSubject,
    record.title,
  ];

  const tryEventPass = (): string | null => {
    for (const src of eventProgramSources) {
      const v = tryTitleField(src);
      if (v) return v;
    }
    return null;
  };

  if (loc === "ar") {
    const t1 = tryTitleField(record.titleAr);
    if (t1) return t1;
    const t2 = tryTitleField(record.nameAr);
    if (t2) return t2;
    const ev = tryEventPass();
    if (ev) return ev;
    if (typeKey) {
      const tlab = getAchievementTypeLabel(typeKey, loc);
      if (tlab && tlab !== "—") return tlab;
    }
    const fbAr = safeStr(record.achievementName) || safeStr(record.title);
    if (isDisallowedAchievementTitleToken(fbAr)) {
      return "إنجاز";
    }
    return humanizeRawKeyForDisplay(fbAr, loc);
  }

  const n1 = tryTitleField(record.nameEn);
  if (n1) return n1;
  const n2 = tryTitleField(record.titleEn);
  if (n2) return n2;
  const n3 = tryTitleField(record.title);
  if (n3) return n3;
  const ev = tryEventPass();
  if (ev) return ev;
  if (typeKey) {
    const tlab = getAchievementTypeLabel(typeKey, loc);
    if (tlab && tlab !== "—") return tlab;
  }
  const fbEn = safeStr(record.achievementName) || safeStr(record.title);
  if (isDisallowedAchievementTitleToken(fbEn)) {
    return "Achievement";
  }
  return humanizeRawKeyForDisplay(fbEn, loc);
};
