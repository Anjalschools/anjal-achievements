/**
 * Short-lived in-memory cache for hot public read endpoints.
 * Home-stats cache lives in `home-stats-response-cache.ts` (zero DB deps).
 */

export type { HomeStatsResponseBody } from "./home-stats-response-cache";
export {
  getPublicCache,
  setPublicCache,
  invalidateHomeStatsCache,
} from "./home-stats-response-cache";

export type HomeHighlightsResponseBody = {
  ok: true;
  data: unknown;
};

type Slot<T> = { value: T; expiresAt: number };

const DEFAULT_TTL_MS = 45_000;

let homeHighlightsCache: Slot<HomeHighlightsResponseBody> | null = null;

export const getHomeHighlightsCached = (): HomeHighlightsResponseBody | null => {
  if (!homeHighlightsCache || homeHighlightsCache.expiresAt <= Date.now()) return null;
  return homeHighlightsCache.value;
};

export const setHomeHighlightsCached = (
  value: HomeHighlightsResponseBody,
  ttlMs: number = DEFAULT_TTL_MS
) => {
  homeHighlightsCache = { value, expiresAt: Date.now() + ttlMs };
};

export const invalidateHomeHighlightsPublicCache = () => {
  homeHighlightsCache = null;
};
