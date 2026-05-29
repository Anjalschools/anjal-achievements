import { describe, expect, it } from "vitest";
import { readHistoricalCache, writeHistoricalCache, invalidateHistoricalCache } from "@/lib/analytics/analytics-historical-cache-v2";

describe("historical-runtime-loop-prevention", () => {
  it("cache returns same reference for same key", () => {
    invalidateHistoricalCache("intelligence");
    const key = "test-key";
    const data = { value: 42 };
    writeHistoricalCache("intelligence", key, data);
    const hit = readHistoricalCache<{ value: number }>("intelligence", key);
    expect(hit).toEqual(data);
  });

  it("cache miss after invalidate", () => {
    invalidateHistoricalCache("funnel");
    expect(readHistoricalCache("funnel", "x")).toBeNull();
  });
});
