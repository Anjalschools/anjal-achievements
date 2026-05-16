"use client";

import React, { memo, useEffect, useRef, useState } from "react";
import { logChartRenderIntel } from "@/lib/competition-intelligence-debug";

export const LazyChartMount = memo(
  ({
    minHeight = 256,
    children,
    fallback,
    chartId,
    virtualized,
  }: {
    minHeight?: number;
    children: React.ReactNode;
    fallback?: React.ReactNode;
    /** When set, logs chart mount duration in competition intel debug mode. */
    chartId?: string;
    virtualized?: boolean;
  }) => {
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const [visible, setVisible] = useState(false);
    const tVisibleRef = useRef<number | null>(null);

    useEffect(() => {
      const el = wrapRef.current;
      if (!el || visible) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            tVisibleRef.current = performance.now();
            setVisible(true);
            io.disconnect();
          }
        },
        { rootMargin: "140px 0px", threshold: 0.02 }
      );
      io.observe(el);
      return () => io.disconnect();
    }, [visible]);

    useEffect(() => {
      if (!visible || !chartId) return;
      const t0 = tVisibleRef.current ?? performance.now();
      let cancelled = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          logChartRenderIntel({
            chartId,
            durationMs: Math.round(performance.now() - t0),
            virtualized: virtualized ?? false,
          });
        });
      });
      return () => {
        cancelled = true;
      };
    }, [visible, chartId, virtualized]);

    return (
      <div ref={wrapRef} className="w-full" style={{ minHeight }}>
        {visible ? (
          children
        ) : (
          fallback ?? <div className="animate-pulse rounded-xl bg-slate-100" style={{ minHeight }} aria-hidden />
        )}
      </div>
    );
  }
);
LazyChartMount.displayName = "LazyChartMount";
