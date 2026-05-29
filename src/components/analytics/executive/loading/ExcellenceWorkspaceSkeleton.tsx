"use client";

import { memo } from "react";

const ExcellenceWorkspaceSkeleton = memo(() => (
  <div className="space-y-4" aria-busy="true">
    <div className="h-24 animate-pulse rounded-2xl bg-teal-50" />
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="h-52 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-52 animate-pulse rounded-2xl bg-slate-100" />
    </div>
    <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
  </div>
));

ExcellenceWorkspaceSkeleton.displayName = "ExcellenceWorkspaceSkeleton";

export default ExcellenceWorkspaceSkeleton;
