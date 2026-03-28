import type { Document as MongooseDocument } from "mongoose";

/** Fields that may be empty strings from the admin UI but must not be persisted for Mongoose enum validation. */
export const ACHIEVEMENT_ADMIN_NORM_KEYS = [
  "medalType",
  "rank",
  "participationType",
  "teamRole",
  "nominationText",
  "specialAwardText",
  "recognitionText",
  "otherResultText",
  "customAchievementName",
] as const;

export type AchievementAdminNormKey = (typeof ACHIEVEMENT_ADMIN_NORM_KEYS)[number];

export const emptyToUndefined = (v: unknown): unknown => {
  if (typeof v === "string" && v.trim() === "") return undefined;
  return v;
};

/**
 * Mutates a plain achievement-shaped object: trim empty strings to undefined, then clear
 * subtype fields that do not apply to the current `resultType` / `participationType`.
 */
export const normalizeAchievementAdminShape = (doc: Record<string, unknown>): void => {
  doc.medalType = emptyToUndefined(doc.medalType);
  doc.rank = emptyToUndefined(doc.rank);
  doc.participationType = emptyToUndefined(doc.participationType);
  doc.teamRole = emptyToUndefined(doc.teamRole);
  doc.nominationText = emptyToUndefined(doc.nominationText);
  doc.specialAwardText = emptyToUndefined(doc.specialAwardText);
  doc.recognitionText = emptyToUndefined(doc.recognitionText);
  doc.otherResultText = emptyToUndefined(doc.otherResultText);
  doc.customAchievementName = emptyToUndefined(doc.customAchievementName);

  const resultType = String(doc.resultType ?? "").trim();
  const participationType = String(doc.participationType ?? "").trim();

  if (resultType !== "medal") doc.medalType = undefined;
  if (resultType !== "rank") doc.rank = undefined;
  if (resultType !== "nomination") doc.nominationText = undefined;
  if (resultType !== "special_award") doc.specialAwardText = undefined;
  if (resultType !== "recognition") doc.recognitionText = undefined;
  if (resultType !== "other") doc.otherResultText = undefined;

  if (participationType !== "team") doc.teamRole = undefined;

  if (!doc.participationType || String(doc.participationType).trim() === "") {
    doc.participationType = "individual";
  }
};

const syncPlainToMongoose = (doc: MongooseDocument, plain: Record<string, unknown>): void => {
  for (const k of ACHIEVEMENT_ADMIN_NORM_KEYS) {
    const v = plain[k];
    doc.set(k, v === undefined ? undefined : v);
  }
};

/** Load toObject → normalize → write back so `save()` passes enum validators. */
export const normalizeAchievementAdminMongooseDoc = (doc: MongooseDocument): void => {
  const plain = doc.toObject({ depopulate: true }) as Record<string, unknown>;
  normalizeAchievementAdminShape(plain);
  syncPlainToMongoose(doc, plain);
};
