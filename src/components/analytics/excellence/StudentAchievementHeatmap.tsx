"use client";

import { memo, useMemo } from "react";
import type { StudentIntelRow } from "@/lib/student-intelligence-analytics";
import { buildAchievementHeatmap } from "@/lib/analytics/student-excellence-derivations";

export type StudentAchievementHeatmapProps = {
  isAr: boolean;
  rows: StudentIntelRow[];
};

const intensityColor = (v: number): string => {
  if (v >= 75) return "bg-indigo-600";
  if (v >= 50) return "bg-indigo-400";
  if (v >= 25) return "bg-indigo-200";
  return "bg-slate-100";
};

const StudentAchievementHeatmap = memo(({ isAr, rows }: StudentAchievementHeatmapProps) => {
  const cells = useMemo(() => buildAchievementHeatmap(rows), [rows]);
  if (cells.length === 0) {
    return (
      <p className="text-xs text-slate-500">{isAr ? "لا بيانات للخريطة." : "No heatmap data."}</p>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-1 sm:grid-cols-6" dir={isAr ? "rtl" : "ltr"}>
      {cells.slice(0, 24).map((c) => (
        <div
          key={`${c.year}-${c.competition}`}
          className={`flex h-8 items-center justify-center rounded-md text-[8px] font-bold text-white ${intensityColor(c.intensity)}`}
          title={`${c.year} · ${c.intensity}`}
        >
          {c.intensity}
        </div>
      ))}
    </div>
  );
});

StudentAchievementHeatmap.displayName = "StudentAchievementHeatmap";

export default StudentAchievementHeatmap;
