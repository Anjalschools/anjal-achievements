import { describe, expect, it } from "vitest";
import {
  clearCubeCache,
  cubeComputationFingerprint,
  readCubeCache,
  writeCubeCache,
} from "@/lib/analytics/analytics-cube-cache";

describe("analytics-cube-cache", () => {
  it("caches by stable fingerprint", () => {
    clearCubeCache();
    const key = cubeComputationFingerprint({
      years: [2024, 2025],
      dimensions: ["gender"],
      metrics: ["participation"],
      filterHash: "abc",
    });
    writeCubeCache(key, { total: 10 });
    expect(readCubeCache<{ total: number }>(key)?.total).toBe(10);
  });
});
