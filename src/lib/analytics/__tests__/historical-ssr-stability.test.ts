import { describe, expect, it } from "vitest";
import {
  deterministicHistoricalSnapshot,
  stableAnalyticsHash,
  stableYearsKey,
} from "@/lib/analytics/historical-analytics-stable";

describe("historical-ssr-stability", () => {
  it("stableYearsKey is deterministic", () => {
    expect(stableYearsKey([2024, 2022, 2023])).toBe("2022,2023,2024");
    expect(stableYearsKey([2024, 2022, 2023])).toBe(stableYearsKey([2022, 2023, 2024]));
  });

  it("stableAnalyticsHash sorts keys", () => {
    const a = stableAnalyticsHash({ z: "1", a: "2" });
    const b = stableAnalyticsHash({ a: "2", z: "1" });
    expect(a).toBe(b);
  });

  it("deterministicHistoricalSnapshot stable for same input", () => {
    const input = {
      years: [2022, 2023],
      dimension: "combined",
      mode: "historical",
      familyKey: "all",
      tableCount: 10,
      participations: 100,
    };
    expect(deterministicHistoricalSnapshot(input)).toBe(
      deterministicHistoricalSnapshot({ ...input })
    );
  });
});
