"use client";

import { memo, useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { StudentIntelRow } from "@/lib/student-intelligence-analytics";
import { buildStudentRadarProfile } from "@/lib/analytics/student-excellence-derivations";

export type StudentExcellenceRadarProps = {
  isAr: boolean;
  row: StudentIntelRow;
};

const StudentExcellenceRadar = memo(({ isAr, row }: StudentExcellenceRadarProps) => {
  const data = useMemo(() => {
    return buildStudentRadarProfile(row).map((a) => ({
      subject: isAr ? a.labelAr : a.labelEn,
      value: a.value,
    }));
  }, [isAr, row]);

  return (
    <div className="h-52 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: "#475569" }} />
          <Radar dataKey="value" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
});

StudentExcellenceRadar.displayName = "StudentExcellenceRadar";

export default StudentExcellenceRadar;
