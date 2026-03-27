/**
 * In-memory cache for GET /api/public/home-stats only.
 * No mongoose / mongodb imports — safe to load before any DB work.
 */

const DEFAULT_TTL_MS = 45_000;

export type HomeStatsResponseBody = {
  ok: true;
  data: {
    studentsCount: number;
    achievementsCount: number;
    fieldsCount: number;
    awardsCount: number;
  };
};

type Slot = { value: HomeStatsResponseBody; expiresAt: number };

let homeStatsSlot: Slot | null = null;

export type PublicCacheKey = "home-stats";

export const getPublicCache = (key: PublicCacheKey): HomeStatsResponseBody | null => {
  if (key !== "home-stats") return null;
  if (!homeStatsSlot || homeStatsSlot.expiresAt <= Date.now()) return null;
  return homeStatsSlot.value;
};

export const setPublicCache = (
  key: PublicCacheKey,
  value: HomeStatsResponseBody,
  ttlMs: number = DEFAULT_TTL_MS
): void => {
  if (key !== "home-stats") return;
  homeStatsSlot = { value, expiresAt: Date.now() + ttlMs };
};

export const invalidateHomeStatsCache = (): void => {
  homeStatsSlot = null;
};
