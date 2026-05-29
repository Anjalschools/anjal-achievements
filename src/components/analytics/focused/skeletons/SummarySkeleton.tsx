"use client";

export const SummarySkeleton = () => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={`summary-skeleton-${i}`} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
    ))}
  </div>
);

