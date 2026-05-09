type Slot<T> = { value: T; expiresAt: number };

const DEFAULT_TTL_MS = 45_000;

const slots = new Map<string, Slot<unknown>>();

export const getAlumniIntelCached = <T>(key: string): T | null => {
  const s = slots.get(key);
  if (!s || s.expiresAt <= Date.now()) return null;
  return s.value as T;
};

export const setAlumniIntelCached = <T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS) => {
  slots.set(key, { value, expiresAt: Date.now() + ttlMs });
};
