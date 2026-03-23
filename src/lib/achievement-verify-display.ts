/**
 * Bilingual display lines for certificate verification — same mapping rules as achievements UI.
 */

import type { AppreciationCertificateSnapshot } from "@/lib/certificate-content";
import {
  getAchievementDisplayName,
  getAchievementLevelLabel,
  isLikelyTechnicalSlug,
  safeTrim,
} from "@/lib/achievementDisplay";

export type AchievementVerifyDisplayData = {
  titleAr: string;
  titleEn: string;
  levelLabelAr: string;
  levelLabelEn: string;
};

const pickTitle = (
  snap: string | undefined,
  record: Record<string, unknown>,
  loc: "ar" | "en"
): string => {
  const s = safeTrim(snap);
  if (s && !isLikelyTechnicalSlug(s)) return s;
  return getAchievementDisplayName(record, loc);
};

const pickLevel = (
  snap: string | undefined,
  record: Record<string, unknown>,
  loc: "ar" | "en"
): string => {
  const s = safeTrim(snap);
  if (s && !isLikelyTechnicalSlug(s)) return s;
  return getAchievementLevelLabel(record.achievementLevel || record.level, loc);
};

/**
 * Resolves achievement title and level labels for verification pages (and similar read-only views).
 * Prefers human-readable snapshot text when present; falls back to shared display helpers when values look like DB slugs.
 */
export const getAchievementDisplayData = (record: Record<string, unknown>): AchievementVerifyDisplayData => {
  const snap = record.certificateSnapshot as Partial<AppreciationCertificateSnapshot> | undefined;

  return {
    titleAr: pickTitle(snap?.achievementTitleAr, record, "ar"),
    titleEn: pickTitle(snap?.achievementTitleEn, record, "en"),
    levelLabelAr: pickLevel(snap?.levelAr, record, "ar"),
    levelLabelEn: pickLevel(snap?.levelEn, record, "en"),
  };
};

/** Matches printed certificate footer ID style (display-only). */
export const formatCertificateDisplayId = (id?: string | null): string => {
  if (!id || !String(id).trim()) return "CERT-2026-000000";
  return `CERT-2026-${String(id).trim().slice(0, 6).toUpperCase()}`;
};
