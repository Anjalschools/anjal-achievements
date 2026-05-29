"use client";

import { memo } from "react";

export type ExecutiveCollapsedPreviewProps = {
  isAr: boolean;
  items: Array<{ label: string; value: string }>;
};

const ExecutiveCollapsedPreview = memo(({ items }: ExecutiveCollapsedPreviewProps) => {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5 print:hidden" aria-label="KPI preview">
      {items.slice(0, 6).map((item) => (
        <li
          key={`${item.label}-${item.value}`}
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
        >
          <span className="text-slate-500">{item.label}: </span>
          <span className="tabular-nums text-slate-900">{item.value}</span>
        </li>
      ))}
    </ul>
  );
});

ExecutiveCollapsedPreview.displayName = "ExecutiveCollapsedPreview";

export default ExecutiveCollapsedPreview;
