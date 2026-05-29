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
    eager = false,
  }: {
    minHeight?: number;
    children: React.ReactNode;
    fallback?: React.ReactNode;
    /** When set, logs chart mount duration in competition intel debug mode. */
    chartId?: string;
    virtualized?: boolean;
    /** Mount chart immediately (skip intersection deferral). */
    eager?: boolean;
  }) => {
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const [visible, setVisible] = useState(eager);
    const tVisibleRef = useRef<number | null>(null);

    useEffect(() => {
      if (eager) {
        setVisible(true);
        const el = wrapRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 8 && rect.height > 8) {
            window.dispatchEvent(new Event("resize"));
          }
        });
        ro.observe(el);
        return () => ro.disconnect();
      }
      const el = wrapRef.current;
      if (!el || visible) return;

      const tryReveal = (): boolean => {
        const rect = el.getBoundingClientRect();
        const inView =
          rect.width > 6 &&
          rect.height > 6 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight + 200;
        if (inView) {
          tVisibleRef.current = performance.now();
          setVisible(true);
          return true;
        }
        return false;
      };

      if (tryReveal()) return;

      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            tVisibleRef.current = performance.now();
            setVisible(true);
            io.disconnect();
            ro.disconnect();
          }
        },
        { rootMargin: "160px 0px", threshold: 0.01 }
      );
      const ro = new ResizeObserver(() => {
        if (tryReveal()) {
          io.disconnect();
          ro.disconnect();
        }
      });
      io.observe(el);
      ro.observe(el);
      return () => {
        io.disconnect();
        ro.disconnect();
      };
    }, [eager, visible]);

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
      <div ref={wrapRef} className="w-full" style={{ minHeight, height: visible ? minHeight : minHeight }}>
        {visible ?
          children
        : (fallback ?? (
            <div
              className="animate-pulse rounded-xl bg-slate-100"
              style={{ minHeight, height: minHeight }}
              aria-hidden
            />
          ))
        }
      </div>
    );
  }
);
LazyChartMount.displayName = "LazyChartMount";
