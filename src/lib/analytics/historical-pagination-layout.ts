/**
 * Multi-year pagination — year blocks for readable historical tables.
 */

import type { HistoricalYearColumnGroup } from "@/lib/analytics/historical-comparison-table-engine";
import { formatAcademicYearRangeLabel } from "@/lib/analytics/competition-year-normalizer";

export type YearPageBlock = {
  id: string;
  labelAr: string;
  labelEn: string;
  years: number[];
  yearGroups: HistoricalYearColumnGroup[];
};

export const DEFAULT_YEARS_PER_BLOCK = 2;

export const groupYearsIntoPageBlocks = (
  yearGroups: HistoricalYearColumnGroup[],
  yearsPerBlock = DEFAULT_YEARS_PER_BLOCK
): YearPageBlock[] => {
  const sorted = [...yearGroups].sort((a, b) => a.year - b.year);
  if (sorted.length <= yearsPerBlock) {
    return [
      {
        id: "all",
        labelAr: sorted.map((g) => g.year).join(" · "),
        labelEn: sorted.map((g) => g.year).join(" · "),
        years: sorted.map((g) => g.year),
        yearGroups: sorted,
      },
    ];
  }

  const blocks: YearPageBlock[] = [];
  for (let i = 0; i < sorted.length; i += yearsPerBlock) {
    const chunk = sorted.slice(i, i + yearsPerBlock);
    const first = chunk[0]!.year;
    const last = chunk[chunk.length - 1]!.year;
    blocks.push({
      id: `${first}-${last}`,
      labelAr: `${formatAcademicYearRangeLabel(first)} – ${formatAcademicYearRangeLabel(last)}`,
      labelEn: `${formatAcademicYearRangeLabel(first)} – ${formatAcademicYearRangeLabel(last)}`,
      years: chunk.map((g) => g.year),
      yearGroups: chunk,
    });
  }
  return blocks;
};

export const sliceModelToYearBlock = <
  T extends { yearGroups: HistoricalYearColumnGroup[]; rows: Array<{ cells: Record<string, number> }> },
>(
  model: T,
  block: YearPageBlock
): T => {
  const keys = new Set(
    block.yearGroups.flatMap((g) => g.metrics.map((m) => `${g.year}__${m.key}`))
  );
  return {
    ...model,
    yearGroups: block.yearGroups,
    rows: model.rows.map((row) => {
      const cells: Record<string, number> = {};
      for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(row.cells, k)) {
          cells[k] = row.cells[k] ?? 0;
        }
      }
      return { ...row, cells };
    }),
  };
};
