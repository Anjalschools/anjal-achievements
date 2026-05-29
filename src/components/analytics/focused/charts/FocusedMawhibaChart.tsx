"use client";

import { memo, useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { FocusedChartRuntimeShell } from "@/components/analytics/focused/charts/FocusedChartRuntimeShell";

export const FocusedMawhibaChart = memo(
  ({
    rows,
    isAr,
    hydrationEpoch,
    onRelaxFilters,
  }: {
    rows: Array<{ key: string; name: string; value: number; fill?: string }>;
    isAr: boolean;
    hydrationEpoch: number;
    onRelaxFilters?: () => void;
  }) => {
    const chartRows = useMemo(() => rows, [rows]);
    const cellDefs = useMemo(
      () => chartRows.map((entry) => <Cell key={entry.key} fill={entry.fill} />),
      [chartRows]
    );
    return (
      <FocusedChartRuntimeShell
        chartId="focused-mawhiba-distribution-v2"
        isAr={isAr}
        hydrationEpoch={hydrationEpoch}
        hasData={chartRows.length > 0}
        rowsCount={chartRows.length}
        minHeight={220}
        onRelaxFilters={onRelaxFilters}
      >
        {() => (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={chartRows} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={76}>
                {cellDefs}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </FocusedChartRuntimeShell>
    );
  }
);
FocusedMawhibaChart.displayName = "FocusedMawhibaChart";

