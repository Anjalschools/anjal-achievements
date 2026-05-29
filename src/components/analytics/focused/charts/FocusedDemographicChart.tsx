"use client";

import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ANJAL_CHART } from "@/lib/anjal-chart-theme";
import { FocusedChartRuntimeShell } from "@/components/analytics/focused/charts/FocusedChartRuntimeShell";

export const FocusedDemographicChart = memo(
  ({
    rows,
    isAr,
    hydrationEpoch,
    onRelaxFilters,
  }: {
    rows: Array<{ name: string; male: number; female: number }>;
    isAr: boolean;
    hydrationEpoch: number;
    onRelaxFilters?: () => void;
  }) => {
    const chartRows = useMemo(() => rows, [rows]);
    return (
      <FocusedChartRuntimeShell
        chartId="focused-demographic-section-gender-v2"
        isAr={isAr}
        hydrationEpoch={hydrationEpoch}
        hasData={chartRows.length > 0}
        rowsCount={chartRows.length}
        minHeight={220}
        onRelaxFilters={onRelaxFilters}
      >
        {() => (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartRows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ANJAL_CHART.grid} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="male" stackId="a" fill={ANJAL_CHART.male} name={isAr ? "بنين" : "Male"} radius={[0, 0, 0, 0]} />
              <Bar dataKey="female" stackId="a" fill={ANJAL_CHART.female} name={isAr ? "بنات" : "Female"} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </FocusedChartRuntimeShell>
    );
  }
);
FocusedDemographicChart.displayName = "FocusedDemographicChart";

