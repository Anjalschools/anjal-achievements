"use client";

export const ParticipantsSkeleton = () => (
  <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="h-5 w-44 animate-pulse rounded bg-slate-100" />
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={`participants-skeleton-${i}`} className="h-9 animate-pulse rounded bg-slate-100" />
    ))}
  </div>
);

