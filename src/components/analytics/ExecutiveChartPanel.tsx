"use client";

import React, { memo } from "react";
import { LazyChartMount } from "@/components/admin/LazyChartMount";
import { ChartErrorBoundary } from "@/components/analytics/ChartErrorBoundary";
import {
  chartGuardEmptyMessage,
  type ChartGuardReason,
} from "@/lib/analytics/runtime/chart-runtime-guard";

const ChartSkeleton = ({ height }: { height: number }) => (
  <div
    className="w-full animate-pulse rounded-lg bg-gradient-to-b from-slate-100 to-slate-50"
    style={{ minHeight: height, height }}
    aria-hidden
  />
);

export const ExecutiveChartPanel = memo(
  ({
    chartId,
    isAr,
    minHeight = 256,
    ready,
    guardReason = "empty",
    eager = true,
    onRelaxFilters,
    children,
    loadingLabel,
  }: {
    chartId: string;
    isAr: boolean;
    minHeight?: number;
    ready: boolean;
    guardReason?: ChartGuardReason;
    eager?: boolean;
    onRelaxFilters?: () => void;
    children: React.ReactNode;
    loadingLabel?: string;
  }) => {
    if (!ready) {
      return (
        <div
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 text-center"
          style={{ minHeight }}
          role="status"
        >
          <p className="text-sm font-semibold text-slate-600">{chartGuardEmptyMessage(isAr, guardReason)}</p>
          {onRelaxFilters ? (
            <button
              type="button"
              onClick={onRelaxFilters}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              {isAr ? "توسيع الفلاتر" : "Relax filters"}
            </button>
          ) : null}
        </div>
      );
    }

    return (
      <ChartErrorBoundary chartId={chartId} isAr={isAr} minHeight={minHeight}>
        <LazyChartMount
          chartId={chartId}
          minHeight={minHeight}
          eager={eager}
          fallback={
            <div
              className="flex w-full items-center justify-center rounded-lg bg-slate-100 text-[11px] font-medium text-slate-500"
              style={{ minHeight, height: minHeight }}
            >
              {loadingLabel ?? (isAr ? "تحميل الرسم…" : "Loading chart…")}
            </div>
          }
        >
          <div className="w-full" style={{ width: "100%", height: minHeight, minHeight }}>
            {children}
          </div>
        </LazyChartMount>
      </ChartErrorBoundary>
    );
  }
);
ExecutiveChartPanel.displayName = "ExecutiveChartPanel";

export { ChartSkeleton };
