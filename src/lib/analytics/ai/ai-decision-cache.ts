import type { AiDecisionEngineResult } from "@/lib/analytics/ai/ai-decision-schema";

type CacheEntry = { data: AiDecisionEngineResult; at: number; key: string };

const store = new Map<string, CacheEntry>();
const TTL_MS = 8 * 60_000;
const MAX_ENTRIES = 48;

export const aiDecisionCacheKey = (filterFingerprint: string, aggregationVersion: number): string =>
  `ai-dec|${filterFingerprint}|v${aggregationVersion}`;

export const readAiDecisionCache = (key: string): AiDecisionEngineResult | null => {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.data;
};

export const writeAiDecisionCache = (key: string, data: AiDecisionEngineResult): void => {
  if (store.size >= MAX_ENTRIES) {
    const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) store.delete(oldest[0]);
  }
  store.set(key, { data, at: Date.now(), key });
};

export const invalidateAiDecisionCache = (): void => {
  store.clear();
};
