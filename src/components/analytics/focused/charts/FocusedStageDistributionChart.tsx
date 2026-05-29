"use client";

import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ANJAL_CHART } from "@/lib/anjal-chart-theme";
import { FocusedChartRuntimeShell } from "@/components/analytics/focused/charts/FocusedChartRuntimeShell";

export const FocusedStageDistributionChart = memo(
  ({
    rows,
    isAr,
    hydrationEpoch,
    onRelaxFilters,
  }: {
    rows: Array<{ name: string; n: number }>;
    isAr: boolean;
    hydrationEpoch: number;
    onRelaxFilters?: () => void;
  }) => {
    const chartRows = useMemo(() => rows, [rows]);
    return (
      <FocusedChartRuntimeShell
        chartId="focused-stage-distribution-v2"
        isAr={isAr}
        hydrationEpoch={hydrationEpoch}
        hasData={chartRows.length > 0}
        rowsCount={chartRows.length}
        minHeight={220}
        onRelaxFilters={onRelaxFilters}
      >
        {() => (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ANJAL_CHART.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="n" fill={ANJAL_CHART.participationBlue} name={isAr ? "عدد" : "Count"} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </FocusedChartRuntimeShell>
    );
  }
);
FocusedStageDistributionChart.displayName = "FocusedStageDistributionChart";

