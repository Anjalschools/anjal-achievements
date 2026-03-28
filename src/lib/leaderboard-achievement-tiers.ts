/** Hall leaderboard achievement scope tiers (client-safe; mirrors `normalizeRawLevelToTier`). */
export const LEADERBOARD_ACHIEVEMENT_TIERS = ["school", "regional", "national", "international"] as const;
export type LeaderboardAchievementTier = (typeof LEADERBOARD_ACHIEVEMENT_TIERS)[number];
