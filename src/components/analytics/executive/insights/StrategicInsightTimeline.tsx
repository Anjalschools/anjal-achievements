"use client";

import { memo } from "react";

export type StrategicInsightTimelineProps = {
  isAr: boolean;
  historicalSupport?: boolean;
  impactPercent: number;
};

const StrategicInsightTimeline = memo(
  ({ isAr, historicalSupport, impactPercent }: StrategicInsightTimelineProps) => {
    const points = [0.35, 0.52, 0.48, 0.62, impactPercent / 100].map((v) => Math.min(1, Math.max(0.15, v)));
    return (
      <div className="flex items-end gap-0.5" aria-hidden="true">
        {points.map((h, i) => (
          <span
            key={`trend-${i}`}
            className={`w-1.5 rounded-sm ${historicalSupport ? "bg-indigo-500" : "bg-slate-300"}`}
            style={{ height: `${Math.round(h * 28)}px` }}
          />
        ))}
        <span className="ms-1 text-[9px] font-bold tabular-nums text-slate-500">
          {isAr ? (historicalSupport ? "دعم تاريخي" : "اتجاه") : historicalSupport ? "Historical" : "Trend"}
        </span>
      </div>
    );
  }
);

StrategicInsightTimeline.displayName = "StrategicInsightTimeline";

export default StrategicInsightTimeline;
