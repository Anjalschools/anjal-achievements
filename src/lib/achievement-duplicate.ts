/**
 * Student achievement duplicate detection: same user + normalized name + achievement year.
 * Day/month are not part of duplicate identity.
 */

import mongoose from "mongoose";
import Achievement from "@/models/Achievement";
import { OLYMPIAD_EVENT_OTHER_VALUE } from "@/constants/achievement-ui-categories";

/** Trim, lowercase, collapse whitespace, strip common bidi marks — spacing-safe comparison. */
export const normalizeAchievementNameForDuplicateKey = (raw: string): string =>
  String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u200c\u200f\u202a-\u202e]/g, "");

/**
 * Human-visible achievement name used for duplicate comparison (matches stored semantics for "other" flows).
 */
export const resolveComparableAchievementNameForDuplicate = (input: {
  achievementName: string;
  customAchievementName?: string | null;
}): string => {
  const rawName = String(input.achievementName || "").trim();
  const custom = String(input.customAchievementName || "").trim();
  if (rawName === "other") return (custom || rawName).trim();
  if (rawName === OLYMPIAD_EVENT_OTHER_VALUE) return (custom || rawName).trim();
  return (rawName || custom).trim();
};

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

const isComparableYear = (y: number): boolean =>
  Number.isFinite(y) && Number.isInteger(y) && y >= YEAR_MIN && y <= YEAR_MAX;

/**
 * Year used for duplicate checks from incoming payload: prefer calendar year from
 * `achievementDate` when valid (YYYY-MM-DD…); else `achievementYear`; else current year.
 */
export const resolveAchievementComparableYearFromPayload = (input: {
  achievementDate?: string | null;
  achievementYear?: number | string | null;
}): number => {
  const ds = String(input.achievementDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(ds)) {
    const y = Number.parseInt(ds.slice(0, 4), 10);
    if (isComparableYear(y)) return y;
  }
  const rawY = input.achievementYear;
  let y = NaN;
  if (typeof rawY === "number") y = rawY;
  else if (typeof rawY === "string" && /^\d+$/.test(rawY.trim()))
    y = Number.parseInt(rawY.trim(), 10);
  if (isComparableYear(y)) return y;
  return new Date().getFullYear();
};

/**
 * Year used for duplicate checks from a stored achievement lean document.
 */
export const resolveAchievementComparableYearFromDoc = (row: Record<string, unknown>): number => {
  const d = row.date;
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    if (isComparableYear(y)) return y;
  }
  const rawY = row.achievementYear;
  if (typeof rawY === "number" && isComparableYear(rawY)) return rawY;
  return new Date().getFullYear();
};

export const DUPLICATE_ACHIEVEMENT_RESPONSE = {
  code: "DUPLICATE_ACHIEVEMENT" as const,
  messageAr: "هذا الإنجاز لا يمكن حفظه لأنه مسجل من قبل على النظام.",
  messageEn: "This achievement cannot be saved because it is already registered in the system.",
  hintAr: "يرجى مراجعة إنجازاتك السابقة قبل إعادة الإرسال.",
  hintEn: "Please review your previous achievements before submitting again.",
};

export const hasStudentAchievementDuplicate = async (input: {
  userId: mongoose.Types.ObjectId;
  nameKeyNormalized: string;
  comparableYear: number;
  excludeAchievementId?: mongoose.Types.ObjectId;
}): Promise<boolean> => {
  const rows = await Achievement.find({ userId: input.userId })
    .select("achievementName customAchievementName date achievementYear")
    .lean();

  for (const row of rows) {
    const r = row as unknown as Record<string, unknown>;
    const id = r._id as mongoose.Types.ObjectId | undefined;
    if (input.excludeAchievementId && id && id.equals(input.excludeAchievementId)) continue;

    const comp = resolveComparableAchievementNameForDuplicate({
      achievementName: String(r.achievementName || ""),
      customAchievementName: String(r.customAchievementName || ""),
    });
    if (normalizeAchievementNameForDuplicateKey(comp) !== input.nameKeyNormalized) continue;
    if (resolveAchievementComparableYearFromDoc(r) !== input.comparableYear) continue;
    return true;
  }
  return false;
};
