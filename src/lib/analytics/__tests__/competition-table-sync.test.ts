import { describe, it, expect } from "vitest";
import {
  applyHistoricalDimensionToFilter,
  buildCompetitionTableQueryKey,
} from "@/lib/analytics/competition-table-query-params";
import { defaultAnalyticsFilterState } from "@/lib/analytics/participation-filter-params";
import { buildCompetitionTableFromRecords } from "@/lib/analytics/competition-table-engine";
import { BEBRAS_CONFIG } from "@/lib/competitions/competition-configs";
import { sliceCompetitionTableToYears } from "@/lib/analytics/competition-table-year-slice";

describe("buildCompetitionTableQueryKey", () => {
  it("changes when years change", () => {
    const f = defaultAnalyticsFilterState();
    const k1 = buildCompetitionTableQueryKey({ filter: f, competitionKey: "bebras", years: [2022, 2023] });
    const k2 = buildCompetitionTableQueryKey({ filter: f, competitionKey: "bebras", years: [2023, 2024] });
    expect(k1).not.toBe(k2);
  });

  it("changes when dimension changes", () => {
    const f = defaultAnalyticsFilterState();
    const combined = buildCompetitionTableQueryKey({
      filter: f,
      competitionKey: "bebras",
      years: [2024],
      dimension: "combined",
    });
    const boys = buildCompetitionTableQueryKey({
      filter: f,
      competitionKey: "bebras",
      years: [2024],
      dimension: "boys",
    });
    expect(combined).not.toBe(boys);
  });
});

describe("applyHistoricalDimensionToFilter", () => {
  it("sets female gender for girls dimension", () => {
    const f = applyHistoricalDimensionToFilter(defaultAnalyticsFilterState(), "girls");
    expect(f.gender).toBe("female");
    expect(f.genders).toContain("female");
  });
});

describe("sliceCompetitionTableToYears", () => {
  it("preserves totals for sliced years", () => {
    const model = buildCompetitionTableFromRecords({
      config: BEBRAS_CONFIG,
      years: [2022, 2023, 2024],
      records: [
        { competitionKey: "bebras", year: 2022, rowKey: "primary_ar", columnKey: "participants", count: 10 },
        { competitionKey: "bebras", year: 2023, rowKey: "primary_ar", columnKey: "participants", count: 20 },
        { competitionKey: "bebras", year: 2024, rowKey: "primary_ar", columnKey: "participants", count: 30 },
      ],
    });
    const sliced = sliceCompetitionTableToYears(model, [2023, 2024]);
    const totalRow = sliced.rows.find((r) => r.isTotal);
    expect(sliced.years).toEqual([2023, 2024]);
    expect(totalRow?.cells["2023__participants"]).toBe(20);
    expect(totalRow?.cells["2024__participants"]).toBe(30);
    expect(totalRow?.cells["2022__participants"]).toBeUndefined();
  });
});
