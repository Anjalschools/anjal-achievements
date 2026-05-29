/**
 * Participant export activity label — deterministic fallback chain (no false "unspecified").
 */

import {
  pickAchievementActivityRawString,
  resolveAchievementActivityName,
  type AchievementActivityNameInput,
} from "@/lib/resolve-achievement-activity-name";

const UNSPECIFIED_AR = "(بدون اسم محدد)";
const UNSPECIFIED_EN = "(unspecified name)";

const isUnspecifiedLabel = (label: string): boolean =>
  label.includes(UNSPECIFIED_AR) || label.toLowerCase().includes("unspecified name");

const trim = (v: unknown): string => String(v ?? "").trim();

const pickFromDoc = (doc: Record<string, unknown>): string => {
  const snap = doc.achievementSnapshot as Record<string, unknown> | undefined;
  const chain = [
    doc.activityName,
    doc.achievementName,
    doc.competitionName,
    doc.eventName,
    snap?.name,
    snap?.title,
    snap?.nameAr,
    snap?.nameEn,
    doc.activityRaw,
    pickAchievementActivityRawString(doc as AchievementActivityNameInput),
  ];
  for (const candidate of chain) {
    const s = trim(candidate);
    if (s) return s;
  }
  return "";
};

export type ParticipantActivityNameContext = {
  focusType: string;
  focusRaw: string;
  /** Pre-resolved scoped label from focused envelope (preferred in light/export mode). */
  scopedLabelAr?: string;
  scopedLabelEn?: string;
};

/**
 * Resolve activity column text for a participant row.
 * Never emits "(بدون اسم محدد)" when focus scope or doc carries a usable name.
 */
export const resolveParticipantActivityLabel = (
  doc: Record<string, unknown>,
  loc: "ar" | "en",
  ctx: ParticipantActivityNameContext
): string => {
  const typeKey = trim(doc.achievementType || doc.analyticsCategory || ctx.focusType);
  const scoped = loc === "ar" ? trim(ctx.scopedLabelAr) : trim(ctx.scopedLabelEn);
  if (scoped && !isUnspecifiedLabel(scoped)) return scoped;

  const focusRaw = trim(ctx.focusRaw);
  const fromDoc = pickFromDoc(doc);

  const raw =
    fromDoc && fromDoc !== typeKey
      ? fromDoc
      : focusRaw && focusRaw !== typeKey
        ? focusRaw
        : fromDoc || focusRaw;

  if (!raw) {
    const fallback = resolveAchievementActivityName(typeKey, "", loc, { allowUnspecified: true });
    return fallback;
  }

  if (raw === typeKey && focusRaw && focusRaw !== typeKey) {
    const fromFocus = resolveAchievementActivityName(typeKey, focusRaw, loc);
    if (!isUnspecifiedLabel(fromFocus)) return fromFocus;
    return focusRaw;
  }

  const named = resolveAchievementActivityName(typeKey, raw, loc, { fallbackRaw: focusRaw });
  if (!isUnspecifiedLabel(named)) return named;

  if (focusRaw) return focusRaw;
  if (fromDoc) return fromDoc;
  return named;
};

export type BuildParticipantRowsContext = ParticipantActivityNameContext & {
  light?: boolean;
};

/**
 * Maps aggregation participant docs to export/API participant rows (activity column safe).
 */
export const buildParticipantRows = <TRow extends Record<string, unknown>>(
  rowDocs: Array<Record<string, unknown>>,
  mapRow: (
    doc: Record<string, unknown>,
    activity: { activityLabelAr: string; activityLabelEn: string }
  ) => TRow,
  ctx: BuildParticipantRowsContext
): TRow[] => {
  const scopedAr = ctx.scopedLabelAr ?? (ctx.focusRaw ? resolveParticipantActivityLabel({}, "ar", ctx) : "");
  const scopedEn = ctx.scopedLabelEn ?? (ctx.focusRaw ? resolveParticipantActivityLabel({}, "en", ctx) : "");

  return rowDocs.map((doc) => {
    const activityLabelAr = resolveParticipantActivityLabel(doc, "ar", {
      ...ctx,
      scopedLabelAr: ctx.light ? scopedAr : ctx.scopedLabelAr,
    });
    const activityLabelEn = resolveParticipantActivityLabel(doc, "en", {
      ...ctx,
      scopedLabelEn: ctx.light ? scopedEn : ctx.scopedLabelEn,
    });
    return mapRow(doc, { activityLabelAr, activityLabelEn });
  });
};
