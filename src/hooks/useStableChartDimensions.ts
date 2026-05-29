"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type StableChartDimensions = {
  width: number;
  height: number;
  isStable: boolean;
};

export const useStableChartDimensions = ({
  minHeight = 220,
  debounceMs = 120,
  enabled = true,
}: {
  minHeight?: number;
  debounceMs?: number;
  enabled?: boolean;
} = {}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const [dimensions, setDimensions] = useState<StableChartDimensions>({
    width: 0,
    height: minHeight,
    isStable: false,
  });

  useEffect(() => {
    if (!enabled) {
      setDimensions({ width: 0, height: minHeight, isStable: false });
      return;
    }
    const node = containerRef.current;
    if (!node) return;

    const commit = () => {
      const nextWidth = Math.max(0, Math.floor(node.clientWidth));
      const nextHeight = Math.max(minHeight, Math.floor(node.clientHeight || minHeight));
      if (nextWidth === 0) {
        setDimensions((prev) => ({ ...prev, width: 0, isStable: false }));
        return;
      }
      setDimensions((prev) => {
        if (prev.width === nextWidth && prev.height === nextHeight && prev.isStable) return prev;
        return {
          width: nextWidth,
          height: nextHeight,
          isStable: true,
        };
      });
    };

    const scheduleCommit = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(commit, debounceMs);
      });
    };

    scheduleCommit();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleCommit) : null;
    observer?.observe(node);
    window.addEventListener("resize", scheduleCommit, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", scheduleCommit);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [debounceMs, enabled, minHeight]);

  return useMemo(() => ({ containerRef, dimensions }), [dimensions]);
};

