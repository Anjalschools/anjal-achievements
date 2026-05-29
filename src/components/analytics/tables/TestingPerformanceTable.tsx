"use client";

import HistoricalComparisonTable, {
  type HistoricalComparisonTableProps,
} from "@/components/analytics/tables/HistoricalComparisonTable";

const TestingPerformanceTable = (props: HistoricalComparisonTableProps) => (
  <HistoricalComparisonTable {...props} />
);

export default TestingPerformanceTable;
