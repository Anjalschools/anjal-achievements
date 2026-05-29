"use client";

import IntensityHeatmapGrid, {
  type HeatmapCellInput,
} from "@/components/analytics/IntensityHeatmapGrid";
import type { AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";

export type HistoricalIntensityHeatmapProps = {
  isAr: boolean;
  cells: HeatmapCellInput[];
  titleAr?: string;
  titleEn?: string;
  onDrill?: Parameters<typeof IntensityHeatmapGrid>[0]["onDrill"];
};

const HistoricalIntensityHeatmap = ({
  isAr,
  cells,
  titleAr = "خريطة شدة تاريخية",
  titleEn = "Historical intensity map",
  onDrill,
}: HistoricalIntensityHeatmapProps) => {
  const loc: AnalyticsLocale = isAr ? "ar" : "en";

  if (cells.length === 0) return null;

  return (
    <div dir={isAr ? "rtl" : "ltr"}>
      <h4 className="mb-2 text-xs font-black text-slate-800">{isAr ? titleAr : titleEn}</h4>
      <IntensityHeatmapGrid
        isAr={isAr}
        loc={loc}
        cells={cells}
        onDrill={onDrill}
        maxCells={16}
      />
    </div>
  );
};

export default HistoricalIntensityHeatmap;
