/**
 * Stable memo helpers — deterministic hashes without JSON.stringify in React deps.
 */

import { useMemo, useRef } from "react";
import { stableAnalyticsHash } from "@/lib/analytics/analytics-historical-cache-v2";

export { stableAnalyticsHash };

export const stableYearsKey = (years: number[]): string =>
  years.length > 0 ? [...years].sort((a, b) => a - b).join(",") : "default";

export const useMemoStable = <T,>(
  factory: () => T,
  hash: string
): T => {
  const ref = useRef<{ hash: string; value: T } | null>(null);
  if (ref.current?.hash === hash) return ref.current.value;
  const value = factory();
  ref.current = { hash, value };
  return value;
};

export const useMemoByHash = <T,>(hash: string, factory: () => T): T =>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(factory, [hash]);

export const deterministicHistoricalSnapshot = (input: {
  years: number[];
  dimension: string;
  mode: string;
  familyKey: string;
  displayMode?: string;
  tableCount: number;
  participations: number;
}): string =>
  stableAnalyticsHash({
    y: stableYearsKey(input.years),
    d: input.dimension,
    m: input.mode,
    f: input.familyKey,
    dm: input.displayMode ?? "executive",
    tc: input.tableCount,
    p: input.participations,
  });
