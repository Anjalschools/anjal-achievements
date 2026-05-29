"use client";

import { memo } from "react";
import ExecutiveSkeletonCards from "@/components/analytics/executive/loading/ExecutiveSkeletonCards";

const StrategicInsightSkeleton = memo(() => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading strategic insights">
    <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
    <ExecutiveSkeletonCards count={6} />
  </div>
));

StrategicInsightSkeleton.displayName = "StrategicInsightSkeleton";

export default StrategicInsightSkeleton;
