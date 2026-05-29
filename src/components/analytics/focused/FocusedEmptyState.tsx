"use client";

import { memo } from "react";

export const FocusedEmptyState = memo(
  ({
    isAr,
    title,
    subtitle,
  }: {
    isAr: boolean;
    title?: string;
    subtitle?: string;
  }) => (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
      <p className="font-bold">{title ?? (isAr ? "لا توجد بيانات كافية" : "Not enough data")}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  )
);
FocusedEmptyState.displayName = "FocusedEmptyState";

