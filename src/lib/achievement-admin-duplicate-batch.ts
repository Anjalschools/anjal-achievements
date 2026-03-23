/**
 * Batch year+name duplicate hints for a page of achievements (same student + normalized name + comparable year).
 * One extra query for all userIds on the page — no N+1 per row.
 */

import mongoose from "mongoose";
import Achievement from "@/models/Achievement";
import {
  normalizeAchievementNameForDuplicateKey,
  resolveAchievementComparableYearFromDoc,
  resolveComparableAchievementNameForDuplicate,
} from "@/lib/achievement-duplicate";

export type YearDuplicateHint = {
  hasYearDuplicate: boolean;
  yearDuplicateCount: number;
};

const DUP_SELECT =
  "userId achievementName customAchievementName date achievementYear status updatedAt nameAr nameEn title";

/**
 * @param rows Lean achievement docs with `userId` as ObjectId (not populated).
 */
export const batchYearDuplicateHintsForAchievements = async (
  rows: Record<string, unknown>[]
): Promise<Map<string, YearDuplicateHint>> => {
  const out = new Map<string, YearDuplicateHint>();
  if (rows.length === 0) return out;

  const userIds = new Set<string>();
  for (const r of rows) {
    const uid = r.userId as mongoose.Types.ObjectId | undefined;
    if (uid) userIds.add(String(uid));
  }
  if (userIds.size === 0) {
    for (const r of rows) {
      const id = String((r._id as mongoose.Types.ObjectId).toString());
      out.set(id, { hasYearDuplicate: false, yearDuplicateCount: 0 });
    }
    return out;
  }

  const oidList = [...userIds].map((id) => new mongoose.Types.ObjectId(id));
  const allOfUsers = await Achievement.find({ userId: { $in: oidList } })
    .select(DUP_SELECT)
    .lean();

  const byUser = new Map<string, Record<string, unknown>[]>();
  for (const doc of allOfUsers) {
    const r = doc as unknown as Record<string, unknown>;
    const uid = r.userId as mongoose.Types.ObjectId | undefined;
    if (!uid) continue;
    const k = String(uid);
    if (!byUser.has(k)) byUser.set(k, []);
    byUser.get(k)!.push(r);
  }

  for (const row of rows) {
    const id = String((row._id as mongoose.Types.ObjectId).toString());
    const uid = row.userId as mongoose.Types.ObjectId | undefined;
    if (!uid) {
      out.set(id, { hasYearDuplicate: false, yearDuplicateCount: 0 });
      continue;
    }

    const peers = byUser.get(String(uid)) || [];
    const comparableYear = resolveAchievementComparableYearFromDoc(row);
    const comparableName = resolveComparableAchievementNameForDuplicate({
      achievementName: String(row.achievementName || ""),
      customAchievementName: String(row.customAchievementName || ""),
    });
    const nameKey = normalizeAchievementNameForDuplicateKey(comparableName);

    if (!nameKey) {
      out.set(id, { hasYearDuplicate: false, yearDuplicateCount: 0 });
      continue;
    }

    let count = 0;
    for (const p of peers) {
      const pid = String((p._id as mongoose.Types.ObjectId).toString());
      if (pid === id) continue;
      const pn = resolveComparableAchievementNameForDuplicate({
        achievementName: String(p.achievementName || ""),
        customAchievementName: String(p.customAchievementName || ""),
      });
      if (normalizeAchievementNameForDuplicateKey(pn) !== nameKey) continue;
      if (resolveAchievementComparableYearFromDoc(p) !== comparableYear) continue;
      count++;
    }

    out.set(id, { hasYearDuplicate: count > 0, yearDuplicateCount: count });
  }

  return out;
};
