const PROTOTYPE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const isSafeKey = (key: string): boolean => {
  if (!key || PROTOTYPE_KEYS.has(key)) return false;
  if (key.startsWith("$")) return false;
  if (key.includes("$")) return false;
  return true;
};

/**
 * Recursively removes Mongo-style operator keys ($gt, $ne, $regex, …) and prototype keys
 * from plain objects. Use before merging user-controlled objects into filters/updates.
 */
export const sanitizeMongoShape = <T>(value: T): T => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMongoShape(item)) as T;
  }
  if (typeof value === "object" && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!isSafeKey(k)) continue;
      out[k] = sanitizeMongoShape(v);
    }
    return out as T;
  }
  return value;
};
