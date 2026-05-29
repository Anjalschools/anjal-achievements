"use client";

import { memo } from "react";

const HistoricalLoadingTimeline = memo(() => (
  <div className="flex items-end gap-1 py-4" aria-hidden="true">
    {Array.from({ length: 8 }).map((_, i) => (
      <span
        key={`ht-${i}`}
        className="w-2 animate-pulse rounded-sm bg-slate-200"
        style={{ height: `${20 + (i % 4) * 8}px` }}
      />
    ))}
  </div>
));

HistoricalLoadingTimeline.displayName = "HistoricalLoadingTimeline";

export default HistoricalLoadingTimeline;
