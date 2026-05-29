"use client";

import { memo } from "react";
import type { EliteCluster } from "@/lib/analytics/student-excellence-derivations";

export type StudentEliteClusterMapProps = {
  isAr: boolean;
  clusters: EliteCluster[];
};

const StudentEliteClusterMap = memo(({ isAr, clusters }: StudentEliteClusterMapProps) => (
  <div className="grid gap-2 sm:grid-cols-2" dir={isAr ? "rtl" : "ltr"}>
    {clusters.map((c) => (
      <div key={c.id} className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
        <p className="text-xs font-black text-violet-950">{isAr ? c.labelAr : c.labelEn}</p>
        <p className="mt-1 text-[10px] text-violet-800">
          {isAr ? `${c.memberIds.length} طالب` : `${c.memberIds.length} students`}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {c.memberIds.slice(0, 6).map((id) => (
            <span
              key={id}
              className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-mono text-slate-600 ring-1 ring-violet-100"
            >
              {id.slice(-6)}
            </span>
          ))}
        </div>
      </div>
    ))}
  </div>
));

StudentEliteClusterMap.displayName = "StudentEliteClusterMap";

export default StudentEliteClusterMap;
