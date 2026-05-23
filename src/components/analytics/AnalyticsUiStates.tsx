"use client";

import { Loader2, RefreshCw } from "lucide-react";

export const AnalyticsChartSkeleton = ({ height = 256 }: { height?: number }) => (
  <div
    className="animate-pulse rounded-lg bg-slate-100"
    style={{ minHeight: height, height }}
    aria-hidden
  />
);

export const AnalyticsEmptyState = ({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) => (
  <div className="flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
    <p className="text-sm font-semibold text-slate-600">{message}</p>
    {onRetry ? (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        {retryLabel ?? "Retry"}
      </button>
    ) : null}
  </div>
);

export const AnalyticsLoadingBlock = ({ label }: { label?: string }) => (
  <div className="flex items-center justify-center gap-2 py-12 text-sm font-semibold text-slate-500">
    <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
    <span>{label ?? "…"}</span>
  </div>
);
