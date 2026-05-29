import { describe, expect, it } from "vitest";
import { groupYearsIntoPageBlocks, sliceModelToYearBlock } from "@/lib/analytics/historical-pagination-layout";

describe("historical-pagination-layout", () => {
  it("groups years into 2-year blocks", () => {
    const yearGroups = [
      { year: 2020, labelAr: "2020", labelEn: "2020", metrics: [{ key: "participation", labelAr: "P", labelEn: "P" }] },
      { year: 2021, labelAr: "2021", labelEn: "2021", metrics: [{ key: "participation", labelAr: "P", labelEn: "P" }] },
      { year: 2022, labelAr: "2022", labelEn: "2022", metrics: [{ key: "participation", labelAr: "P", labelEn: "P" }] },
    ] as any;
    const blocks = groupYearsIntoPageBlocks(yearGroups, 2);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.years).toEqual([2020, 2021]);
    expect(blocks[1]!.years).toEqual([2022]);
  });

  it("slices model cells to active block", () => {
    const model = {
      yearGroups: [
        { year: 2020, labelAr: "2020", labelEn: "2020", metrics: [{ key: "participation", labelAr: "P", labelEn: "P" }] },
        { year: 2021, labelAr: "2021", labelEn: "2021", metrics: [{ key: "participation", labelAr: "P", labelEn: "P" }] },
      ],
      rows: [
        { cells: { "2020__participation": 1, "2021__participation": 2 } },
      ],
    } as any;
    const blocks = groupYearsIntoPageBlocks(model.yearGroups, 1);
    const sliced = sliceModelToYearBlock(model, blocks[0]!);
    expect(Object.keys(sliced.rows[0]!.cells)).toEqual(["2020__participation"]);
  });
});

