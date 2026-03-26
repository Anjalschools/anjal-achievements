/**
 * Short-lived in-memory cache for getCurrentDbUser() to cut repeated Mongo lookups
 * within the same Node process (dev / long-running server). Serverless still benefits
 * from warm invocations handling multiple auth checks in one request lifecycle.
 */
const TTL_MS = 7 * 60 * 1000; // 7 minutes

type CachedUser = Record<string, unknown> | null;

type Entry = { value: CachedUser; expiresAt: number };

const store = new Map<string, Entry>();

const now = () => Date.now();

export const getCachedDbUser = (key: string): CachedUser | undefined => {
  const e = store.get(key);
  if (!e || e.expiresAt <= now()) {
    if (e) store.delete(key);
    return undefined;
  }
  return e.value;
};

export const setCachedDbUser = (key: string, user: CachedUser) => {
  store.set(key, { value: user, expiresAt: now() + TTL_MS });
};

/** Invalidate after profile updates or role changes. */
export const invalidateSessionUserCache = (userId?: string, email?: string) => {
  if (userId) store.delete(`id:${userId}`);
  if (email) store.delete(`email:${email.toLowerCase().trim()}`);
};

export const clearAllSessionUserCache = () => store.clear();
