import { describe, expect, it } from "vitest";
import { buildCompetitionTableFromRecords } from "@/lib/analytics/competition-table-engine";
import { BEBRAS_CONFIG } from "@/lib/competitions/competition-configs";
import { resolveStudentStageRowKey } from "@/lib/competitions/competition-row-resolver";

describe("competition-table-engine", () => {
  it("resolves excel row keys from grade and section", () => {
    expect(resolveStudentStageRowKey({ grade: "g10", section: "arabic" })).toBe("secondary_ar");
    expect(resolveStudentStageRowKey({ grade: "g3", section: "international" })).toBe("primary_intl");
  });

  it("aggregates medal cells and totals", () => {
    const model = buildCompetitionTableFromRecords({
      config: BEBRAS_CONFIG,
      years: [2024],
      records: [
        { competitionKey: "bebras", year: 2024, rowKey: "secondary_ar", columnKey: "participants", count: 10 },
        { competitionKey: "bebras", year: 2024, rowKey: "secondary_ar", columnKey: "gold", count: 2 },
        { competitionKey: "bebras", year: 2024, rowKey: "secondary_ar", columnKey: "silver", count: 1 },
      ],
    });
    const row = model.rows.find((r) => r.key === "secondary_ar");
    expect(row?.cells["2024__participants"]).toBe(10);
    expect(row?.cells["2024__total"]).toBe(3);
    expect(model.metrics.qualityScore).toBeGreaterThan(0);
  });
});
