"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChartErrorBoundary } from "@/components/analytics/ChartErrorBoundary";
import { FocusedChartSkeleton } from "@/components/analytics/focused/charts/FocusedChartSkeleton";
import { FocusedChartEmptyState } from "@/components/analytics/focused/charts/FocusedChartEmptyState";
import { useStableChartDimensions } from "@/hooks/useStableChartDimensions";
import { useClientMounted } from "@/hooks/useClientMounted";
import {
  isChartResizeFrozen,
  recordChartMount,
  recordChartRender,
  recordChartResize,
  shouldChartDisableAnimation,
  shouldChartUseSimplifiedMode,
} from "@/lib/analytics/runtime/chart-watchdog";
import { recordExecChartRenderDuration } from "@/lib/analytics/runtime/runtime-health-registry";

export type FocusedChartRuntimeContext = {
  width: number;
  height: number;
  simplifiedMode: boolean;
  disableAnimation: boolean;
};

type Props = {
  chartId: string;
  isAr: boolean;
  minHeight?: number;
  rowsCount?: number;
  hydrationEpoch: number;
  enabled?: boolean;
  parentExpanded?: boolean;
  hasData: boolean;
  emptyReason?: string;
  onRelaxFilters?: () => void;
  children: (ctx: FocusedChartRuntimeContext) => ReactNode;
};

export const FocusedChartRuntimeShell = memo(
  ({
    chartId,
    isAr,
    minHeight = 220,
    rowsCount = 0,
    hydrationEpoch,
    enabled = true,
    parentExpanded = true,
    hasData,
    emptyReason,
    onRelaxFilters,
    children,
  }: Props) => {
    const ioRef = useRef<HTMLDivElement | null>(null);
    const clientMounted = useClientMounted();
    const [inView, setInView] = useState(false);
    const [chartReady, setChartReady] = useState(false);
    const resizeFrozen = isChartResizeFrozen(chartId);
    const simplifiedMode = shouldChartUseSimplifiedMode(chartId);
    const disableAnimation = shouldChartDisableAnimation(chartId);
    const dimensionsEnabled =
      enabled && parentExpanded && inView && !resizeFrozen;
    const { containerRef, dimensions } = useStableChartDimensions({
      minHeight,
      enabled: dimensionsEnabled,
      debounceMs: simplifiedMode ? 220 : 120,
    });

    useEffect(() => {
      if (!enabled || !parentExpanded) return;
      recordChartMount(chartId);
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.info("[FOCUSED_CHART_MOUNT]", { chartId, hydrationEpoch, simplifiedMode });
      }
    }, [chartId, enabled, parentExpanded, hydrationEpoch, simplifiedMode]);

    useEffect(() => {
      if (!clientMounted) return;
      const node = ioRef.current;
      if (!node) return;
      if (typeof IntersectionObserver === "undefined") {
        setInView(true);
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          if (entry.isIntersecting) setInView(true);
        },
        { rootMargin: "160px", threshold: 0.01 }
      );
      observer.observe(node);
      return () => observer.disconnect();
    }, [clientMounted]);

    const canHydrate =
      clientMounted && enabled && parentExpanded && inView && dimensions.isStable && dimensions.width > 0;
    useEffect(() => {
      if (!canHydrate) {
        setChartReady(false);
        return;
      }
      setChartReady(true);
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.info("[FOCUSED_CHART_HYDRATED]", {
          chartId,
          hydrationEpoch,
          width: dimensions.width,
          height: dimensions.height,
        });
      }
    }, [canHydrate, chartId, hydrationEpoch, dimensions.width, dimensions.height]);

    useEffect(() => {
      if (!chartReady) return;
      recordChartResize(chartId);
      if (process.env.NODE_ENV === "production") return;
      // eslint-disable-next-line no-console
      console.info("[FOCUSED_CHART_RESIZE]", {
        chartId,
        hydrationEpoch,
        width: dimensions.width,
        height: dimensions.height,
        resizeFrozen,
      });
    }, [chartId, hydrationEpoch, chartReady, dimensions.width, dimensions.height, resizeFrozen]);

    const shouldMeasureRender = clientMounted && chartReady && hasData && enabled && parentExpanded && inView;

    useLayoutEffect(() => {
      if (!shouldMeasureRender) return;
      const t0 = performance.now();
      return () => {
        const durationMs = Math.round(performance.now() - t0);
        recordChartRender(chartId, durationMs);
        recordExecChartRenderDuration(chartId, durationMs);
      };
    }, [shouldMeasureRender, chartId, dimensions.width, dimensions.height, hydrationEpoch, rowsCount]);

    const body = useMemo(() => {
      if (!clientMounted || !enabled || !parentExpanded) return <FocusedChartSkeleton minHeight={minHeight} />;
      if (!inView || !dimensions.isStable || !chartReady) return <FocusedChartSkeleton minHeight={minHeight} />;
      if (!hasData) {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.info("[FOCUSED_CHART_EMPTY]", { chartId, hydrationEpoch, rowsCount });
        }
        return (
          <FocusedChartEmptyState
            isAr={isAr}
            minHeight={minHeight}
            reason={emptyReason}
            onRelaxFilters={onRelaxFilters}
          />
        );
      }
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.info("[FOCUSED_CHART_RENDER]", {
          chartId,
          hydrationEpoch,
          rowsCount,
          width: dimensions.width,
          height: dimensions.height,
          simplifiedMode,
        });
      }
      const chartCtx: FocusedChartRuntimeContext = {
        width: dimensions.width,
        height: dimensions.height,
        simplifiedMode,
        disableAnimation,
      };
      return (
        <ChartErrorBoundary chartId={chartId} isAr={isAr} minHeight={minHeight}>
          {children(chartCtx)}
        </ChartErrorBoundary>
      );
    }, [
      clientMounted,
      chartReady,
      enabled,
      parentExpanded,
      inView,
      dimensions,
      hasData,
      chartId,
      hydrationEpoch,
      rowsCount,
      isAr,
      minHeight,
      emptyReason,
      onRelaxFilters,
      children,
      simplifiedMode,
      disableAnimation,
    ]);

    return (
      <div ref={ioRef} className="w-full">
        <div ref={containerRef} style={{ minHeight }} className="w-full">
          {body}
        </div>
      </div>
    );
  }
);
FocusedChartRuntimeShell.displayName = "FocusedChartRuntimeShell";

