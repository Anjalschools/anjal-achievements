"use client";

import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ANJAL_CHART } from "@/lib/anjal-chart-theme";
import { FocusedChartRuntimeShell } from "@/components/analytics/focused/charts/FocusedChartRuntimeShell";

export const FocusedYoYChart = memo(
  ({
    rows,
    isAr,
    hydrationEpoch,
    onRelaxFilters,
  }: {
    rows: Array<{ year: string; participants: number; medals: number; excellence: number }>;
    isAr: boolean;
    hydrationEpoch: number;
    onRelaxFilters?: () => void;
  }) => {
    const chartRows = useMemo(() => rows, [rows]);
    return (
      <FocusedChartRuntimeShell
        chartId="focused-yoy-bars-v2"
        isAr={isAr}
        hydrationEpoch={hydrationEpoch}
        hasData={chartRows.length > 0}
        rowsCount={chartRows.length}
        minHeight={256}
        onRelaxFilters={onRelaxFilters}
      >
        {() => (
          <ResponsiveContainer width="100%" height={256}>
            <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ANJAL_CHART.grid} />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="a" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis yAxisId="b" orientation="right" tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="a" dataKey="participants" fill={ANJAL_CHART.anjalBlue} name={isAr ? "طلاب" : "Students"} radius={[6, 6, 0, 0]} />
              <Bar yAxisId="a" dataKey="medals" fill={ANJAL_CHART.gold} name={isAr ? "ميداليات" : "Medals"} radius={[6, 6, 0, 0]} />
              <Bar yAxisId="b" dataKey="excellence" fill={ANJAL_CHART.successGreen} name={isAr ? "تميز %" : "Excellence %"} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </FocusedChartRuntimeShell>
    );
  }
);
FocusedYoYChart.displayName = "FocusedYoYChart";

