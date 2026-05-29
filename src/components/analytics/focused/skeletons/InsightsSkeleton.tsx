"use client";

export const InsightsSkeleton = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="h-5 w-48 animate-pulse rounded bg-slate-100" />
    <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-100" />
    <div className="mt-2 h-4 w-10/12 animate-pulse rounded bg-slate-100" />
    <div className="mt-2 h-4 w-8/12 animate-pulse rounded bg-slate-100" />
  </div>
);

