import { getAchievementDisplayName } from "@/lib/achievementDisplay";
import { getDbAchievementTypeLabel } from "@/lib/achievement-labels";

export type AchievementActivityNameInput = {
  achievementType?: string;
  achievementCategory?: string;
  customAchievementName?: string;
  achievementName?: string;
  competitionName?: string;
  customCompetitionName?: string;
  programName?: string;
  customProgramName?: string;
  exhibitionName?: string;
  customExhibitionName?: string;
  olympiadMeeting?: string;
  olympiadField?: string;
  inferredField?: string;
  nameAr?: string;
  nameEn?: string;
  title?: string;
};

/**
 * Same priority order as achievement registration / participation analytics `activityRaw` pipeline:
 * prefer the most specific human-entered label, then type-wide fallbacks, then achievement type key.
 */
export const pickAchievementActivityRawString = (doc: AchievementActivityNameInput): string => {
  const s = (v: unknown) => String(v ?? "").trim();
  if (s(doc.customAchievementName)) return s(doc.customAchievementName);
  if (s(doc.achievementName)) return s(doc.achievementName);
  if (s(doc.inferredField)) return s(doc.inferredField);
  if (s(doc.customProgramName)) return s(doc.customProgramName);
  if (s(doc.programName)) return s(doc.programName);
  if (s(doc.customCompetitionName)) return s(doc.customCompetitionName);
  if (s(doc.competitionName)) return s(doc.competitionName);
  if (s(doc.customExhibitionName)) return s(doc.customExhibitionName);
  if (s(doc.exhibitionName)) return s(doc.exhibitionName);
  const om = s(doc.olympiadMeeting);
  const of = s(doc.olympiadField);
  if (om && of) return `${om} — ${of}`;
  if (om) return om;
  if (of) return of;
  if (s(doc.nameAr)) return s(doc.nameAr);
  if (s(doc.title)) return s(doc.title);
  return s(doc.achievementType) || s(doc.achievementCategory) || "";
};

/**
 * Resolves the **real activity name** for analytics, exports, charts, and dashboards.
 * @param achievementTypeKey - DB `achievementType` for the row / group
 * @param activityRaw - resolved raw string from the same pipeline as registration (see `pickAchievementActivityRawString`)
 */
export const resolveAchievementActivityName = (
  achievementTypeKey: string,
  activityRaw: string,
  loc: "ar" | "en",
  options?: { fallbackRaw?: string; allowUnspecified?: boolean }
): string => {
  const t = String(achievementTypeKey || "").trim();
  let r = String(activityRaw || "").trim();
  const fallback = String(options?.fallbackRaw ?? "").trim();
  if ((!r || r === t) && fallback && fallback !== t) {
    r = fallback;
  }
  const typeOnly = getDbAchievementTypeLabel(t, loc);

  if (!r) {
    if (options?.allowUnspecified === false) return typeOnly;
    return loc === "ar" ? `${typeOnly} (بدون اسم محدد)` : `${typeOnly} (unspecified name)`;
  }

  if (r === t) {
    if (fallback && fallback !== t) {
      r = fallback;
    } else if (options?.allowUnspecified === false) {
      return typeOnly;
    } else {
      return loc === "ar" ? `${typeOnly} (بدون اسم محدد)` : `${typeOnly} (unspecified name)`;
    }
  }

  const named = getAchievementDisplayName(
    {
      achievementType: t,
      achievementName: r,
      customAchievementName: r,
    } as Record<string, unknown>,
    loc
  );

  if (named === typeOnly) {
    return loc === "ar" ? `${typeOnly}: ${r}` : `${typeOnly}: ${r}`;
  }
  return named;
};
