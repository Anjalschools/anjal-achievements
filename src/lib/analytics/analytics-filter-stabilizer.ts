/**
 * Stable filter identity — deterministic hashes without JSON.stringify in React deps.
 */

import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import { stableAnalyticsHash } from "@/lib/analytics/analytics-historical-cache-v2";

const arrayPool = new Map<string, string[]>();

export const stableArrayIdentity = (values: string[]): string[] => {
  const key = values.join("\u0001");
  const existing = arrayPool.get(key);
  if (existing) return existing;
  const frozen = [...values];
  arrayPool.set(key, frozen);
  if (arrayPool.size > 200) {
    const first = arrayPool.keys().next().value;
    if (first) arrayPool.delete(first);
  }
  return frozen;
};

export const shallowStableObject = <T extends Record<string, unknown>>(
  obj: T
): T => Object.freeze({ ...obj }) as T;

export const buildDeterministicFilterHash = (filter: ExecutiveFilterSnapshot): string =>
  stableAnalyticsHash({
    ay: (filter.activityYears ?? []).join(","),
    g: filter.gender ?? "",
    gs: (filter.genders ?? []).join(","),
    rt: (filter.resultTokens ?? []).join(","),
    lv: (filter.levels ?? []).join(","),
    gr: (filter.grades ?? []).join(","),
    an: (filter.achievementNames ?? []).join(","),
    cl: filter.classification ?? "",
    acy: filter.academicYear ?? "",
  });

export const stabilizeAnalyticsFilters = (
  filter: ExecutiveFilterSnapshot
): ExecutiveFilterSnapshot => ({
  ...filter,
  activityYears: stableArrayIdentity(filter.activityYears ?? []),
  genders: stableArrayIdentity(filter.genders ?? []),
  resultTokens: stableArrayIdentity(filter.resultTokens ?? []),
  levels: stableArrayIdentity(filter.levels ?? []),
  grades: stableArrayIdentity(filter.grades ?? []),
  achievementNames: stableArrayIdentity(filter.achievementNames ?? []),
});
