import type { HallOfFameStudentRow } from "@/lib/hall-of-fame-service";
import { HALL_LEVEL_PRIORITY, type HallTier } from "@/lib/hall-of-fame-level";

/** Strongest tier label among currently loaded rows (for quick stats strip). */
export const getStrongestTierLabelAmongRows = (rows: HallOfFameStudentRow[]): string | null => {
  if (rows.length === 0) return null;
  let bestTier: HallTier = "participation";
  let bestP = -1;
  for (const r of rows) {
    const p = HALL_LEVEL_PRIORITY[r.highestTier] ?? 0;
    if (p > bestP) {
      bestP = p;
      bestTier = r.highestTier;
    }
  }
  return rows.find((r) => r.highestTier === bestTier)?.highestTierLabel ?? null;
};

export const sumApprovedAchievementsInRows = (rows: HallOfFameStudentRow[]): number =>
  rows.reduce((acc, r) => acc + (typeof r.totalAchievements === "number" ? r.totalAchievements : 0), 0);
