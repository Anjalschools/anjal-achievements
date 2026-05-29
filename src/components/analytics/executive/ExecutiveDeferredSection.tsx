"use client";

import { Suspense, memo, useEffect, useState, type ReactNode } from "react";
import AnalyticsSectionSkeleton from "@/components/analytics/AnalyticsSectionSkeleton";

export type ExecutiveDeferredSectionProps = {
  isAr: boolean;
  enabled: boolean;
  idle?: boolean;
  skeletonLines?: number;
  children: ReactNode;
};

const scheduleIdle = (cb: () => void): (() => void) => {
  if (typeof window === "undefined") {
    cb();
    return () => undefined;
  }
  const ric = window.requestIdleCallback;
  if (ric) {
    const id = ric(cb, { timeout: 120 });
    return () => window.cancelIdleCallback?.(id);
  }
  const t = window.setTimeout(cb, 16);
  return () => window.clearTimeout(t);
};

const ExecutiveDeferredSection = memo(
  ({ isAr, enabled, idle = true, skeletonLines = 4, children }: ExecutiveDeferredSectionProps) => {
    const [ready, setReady] = useState(!idle);

    useEffect(() => {
      if (!enabled) {
        setReady(false);
        return;
      }
      if (!idle) {
        setReady(true);
        return;
      }
      return scheduleIdle(() => setReady(true));
    }, [enabled, idle]);

    if (!enabled) return null;
    if (!ready) {
      return <AnalyticsSectionSkeleton lines={skeletonLines} isAr={isAr} />;
    }

    return <Suspense fallback={<AnalyticsSectionSkeleton lines={skeletonLines} isAr={isAr} />}>{children}</Suspense>;
  }
);

ExecutiveDeferredSection.displayName = "ExecutiveDeferredSection";

export default ExecutiveDeferredSection;
