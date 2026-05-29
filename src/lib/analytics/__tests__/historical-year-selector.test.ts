import { describe, expect, it } from "vitest";
import {
  discoverAvailableHistoricalYears,
  parseHistoricalYearsFromSearchParams,
  serializeHistoricalYearsToSearchParams,
} from "@/lib/analytics/historical-year-url-sync";

describe("historical-year-selector", () => {
  it("parses historicalYears from URL", () => {
    const params = new URLSearchParams("historicalYears=2021,2023,2024");
    expect(parseHistoricalYearsFromSearchParams(params)).toEqual([2021, 2023, 2024]);
  });

  it("falls back to activityYears param", () => {
    const params = new URLSearchParams("activityYears=2022,2024");
    expect(parseHistoricalYearsFromSearchParams(params)).toEqual([2022, 2024]);
  });

  it("serializes years to URL with backward compat", () => {
    const next = serializeHistoricalYearsToSearchParams(
      [2023, 2024],
      new URLSearchParams()
    );
    expect(next.get("historicalYears")).toBe("2023,2024");
    expect(next.get("activityYears")).toBe("2023,2024");
  });

  it("discovers years from slices and filters", () => {
    const years = discoverAvailableHistoricalYears(
      [{ year: 2022 }, { year: 2024 }],
      ["2023"]
    );
    expect(years).toContain(2022);
    expect(years).toContain(2023);
    expect(years).toContain(2024);
  });
});
