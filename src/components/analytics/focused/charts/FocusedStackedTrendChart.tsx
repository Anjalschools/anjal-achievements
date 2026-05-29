"use client";

import { memo, useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ANJAL_CHART } from "@/lib/anjal-chart-theme";
import { FocusedChartRuntimeShell } from "@/components/analytics/focused/charts/FocusedChartRuntimeShell";

export const FocusedStackedTrendChart = memo(
  ({
    rows,
    isAr,
    hydrationEpoch,
    onRelaxFilters,
  }: {
    rows: Array<{ year: string; aPart: number; bPart: number; aMed: number; bMed: number; aEx: number; bEx: number }>;
    isAr: boolean;
    hydrationEpoch: number;
    onRelaxFilters?: () => void;
  }) => {
    const chartRows = useMemo(() => rows, [rows]);
    return (
      <FocusedChartRuntimeShell
        chartId="focused-compare-stacked-trend-v2"
        isAr={isAr}
        hydrationEpoch={hydrationEpoch}
        hasData={chartRows.length > 0}
        rowsCount={chartRows.length}
        minHeight={220}
        onRelaxFilters={onRelaxFilters}
      >
        {() => (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={ANJAL_CHART.grid} />
              <XAxis dataKey="year" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="aPart" fill={ANJAL_CHART.anjalBlue} name={isAr ? "أ طلاب" : "A students"} />
              <Bar dataKey="bPart" fill={ANJAL_CHART.nominationViolet} name={isAr ? "ب طلاب" : "B students"} />
              <Bar dataKey="aMed" fill={ANJAL_CHART.gold} name={isAr ? "أ ميداليات" : "A medals"} />
              <Bar dataKey="bMed" fill={ANJAL_CHART.silver} name={isAr ? "ب ميداليات" : "B medals"} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </FocusedChartRuntimeShell>
    );
  }
);
FocusedStackedTrendChart.displayName = "FocusedStackedTrendChart";

