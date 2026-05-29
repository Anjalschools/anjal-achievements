"use client";

import { memo, useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StudentIntelRow } from "@/lib/student-intelligence-analytics";
import {
  buildGrowthTimeline,
  computeCagrPercent,
} from "@/lib/analytics/student-excellence-derivations";

export type StudentGrowthTimelineProps = {
  isAr: boolean;
  row: StudentIntelRow;
};

const StudentGrowthTimeline = memo(({ isAr, row }: StudentGrowthTimelineProps) => {
  const points = useMemo(() => buildGrowthTimeline(row), [row]);
  const cagr = useMemo(() => computeCagrPercent(points), [points]);
  const chartData = useMemo(
    () => points.map((p) => ({ year: p.year, value: p.value })),
    [points]
  );

  return (
    <div dir="ltr">
      <p className="mb-2 text-[10px] font-bold text-slate-600">
        CAGR: {cagr}% · {isAr ? "ذروة" : "Peak"}: {Math.max(...points.map((p) => p.value))}
      </p>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="year" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

StudentGrowthTimeline.displayName = "StudentGrowthTimeline";

export default StudentGrowthTimeline;
