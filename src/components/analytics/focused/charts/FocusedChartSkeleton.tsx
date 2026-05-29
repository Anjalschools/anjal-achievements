"use client";

export const FocusedChartSkeleton = ({ minHeight = 220 }: { minHeight?: number }) => (
  <div
    className="w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100"
    style={{ minHeight }}
    role="status"
    aria-label="chart-loading"
  />
);

