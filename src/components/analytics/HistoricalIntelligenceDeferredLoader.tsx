"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import AnalyticsSectionSkeleton from "@/components/analytics/AnalyticsSectionSkeleton";
import { scheduleAnalyticsWork } from "@/lib/analytics/analytics-performance-orchestrator";

export type HistoricalIntelligenceDeferredLoaderProps = {
  isAr: boolean;
  enabled: boolean;
  contentKey: string;
  build: () => ReactNode;
  skeletonLines?: number;
};

const HistoricalIntelligenceDeferredLoader = ({
  isAr,
  enabled,
  contentKey,
  build,
  skeletonLines = 6,
}: HistoricalIntelligenceDeferredLoaderProps) => {
  const [content, setContent] = useState<ReactNode | null>(null);
  const buildRef = useRef(build);
  buildRef.current = build;

  useEffect(() => {
    if (!enabled) {
      setContent(null);
      return;
    }

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      setContent(buildRef.current());
    };

    scheduleAnalyticsWork("historicalIntelligence", "BACKGROUND", run);

    return () => {
      cancelled = true;
    };
  }, [enabled, contentKey]);

  if (!enabled) return null;
  if (!content) {
    return <AnalyticsSectionSkeleton lines={skeletonLines} isAr={isAr} />;
  }

  return <>{content}</>;
};

export default memo(HistoricalIntelligenceDeferredLoader);
