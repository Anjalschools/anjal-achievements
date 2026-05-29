"use client";

import { memo, useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StudentIntelRow } from "@/lib/student-intelligence-analytics";

export type StudentAwardDistributionChartProps = {
  isAr: boolean;
  rows: StudentIntelRow[];
};

const StudentAwardDistributionChart = memo(({ isAr, rows }: StudentAwardDistributionChartProps) => {
  const data = useMemo(
    () =>
      rows.slice(0, 8).map((r) => ({
        name: (isAr ? r.nameAr : r.nameEn).slice(0, 12),
        medals: r.medalCount,
        records: r.recordCount,
      })),
    [isAr, rows]
  );

  if (data.length === 0) {
    return <p className="text-xs text-slate-500">{isAr ? "لا بيانات." : "No data."}</p>;
  }

  return (
    <div className="h-44 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} angle={-20} textAnchor="end" height={48} />
          <YAxis tick={{ fontSize: 9 }} />
          <Tooltip />
          <Bar dataKey="medals" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

StudentAwardDistributionChart.displayName = "StudentAwardDistributionChart";

export default StudentAwardDistributionChart;
