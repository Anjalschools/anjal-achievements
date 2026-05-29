"use client";

import { memo } from "react";

const ExecutiveSkeletonCards = memo(({ count = 3 }: { count?: number }) => (
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={`sk-${i}`} className="h-36 animate-pulse rounded-2xl bg-slate-100" />
    ))}
  </div>
));

ExecutiveSkeletonCards.displayName = "ExecutiveSkeletonCards";

export default ExecutiveSkeletonCards;
