"use client";

export const ChartsSkeleton = () => (
  <div className="grid gap-4 lg:grid-cols-2">
    {Array.from({ length: 2 }).map((_, i) => (
      <div key={`charts-skeleton-${i}`} className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
    ))}
  </div>
);

