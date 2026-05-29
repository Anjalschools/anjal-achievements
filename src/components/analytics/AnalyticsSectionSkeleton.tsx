"use client";

export type AnalyticsSectionSkeletonProps = {
  isAr?: boolean;
  lines?: number;
};

const AnalyticsSectionSkeleton = ({ isAr = true, lines = 3 }: AnalyticsSectionSkeletonProps) => (
  <div className="animate-pulse space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-busy="true">
    <div className="h-4 w-40 rounded bg-slate-200" />
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="h-10 rounded-lg bg-slate-100" />
    ))}
    <span className="sr-only">{isAr ? "جاري التحميل…" : "Loading…"}</span>
  </div>
);

export default AnalyticsSectionSkeleton;
