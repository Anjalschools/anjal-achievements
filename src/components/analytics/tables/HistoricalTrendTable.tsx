"use client";

import HistoricalComparisonTable, {
  type HistoricalComparisonTableProps,
} from "@/components/analytics/tables/HistoricalComparisonTable";

/** Trend mode — shows full trend chips + table */
const HistoricalTrendTable = (props: HistoricalComparisonTableProps) => (
  <HistoricalComparisonTable {...props} compact={false} />
);

export default HistoricalTrendTable;
