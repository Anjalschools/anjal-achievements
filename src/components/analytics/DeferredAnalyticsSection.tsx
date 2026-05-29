"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import AnalyticsSectionSkeleton from "@/components/analytics/AnalyticsSectionSkeleton";

export type DeferredAnalyticsSectionProps = {
  children: ReactNode;
  isAr?: boolean;
  skeletonLines?: number;
  rootMargin?: string;
  minHeight?: string;
  freezeWhenHidden?: boolean;
};

const DeferredAnalyticsSection = ({
  children,
  isAr = true,
  skeletonLines = 4,
  rootMargin = "80px",
  minHeight = "0",
  freezeWhenHidden = false,
}: DeferredAnalyticsSectionProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      setHasBeenVisible(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + 120 && rect.bottom > -80) {
      setVisible(true);
      setHasBeenVisible(true);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setVisible(true);
          setHasBeenVisible(true);
        } else if (freezeWhenHidden) {
          setVisible(false);
        }
      },
      { rootMargin, threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, freezeWhenHidden]);

  const showContent = hasBeenVisible || visible;

  return (
    <div
      ref={ref}
      style={showContent ? undefined : minHeight !== "0" ? { minHeight } : undefined}
      dir={isAr ? "rtl" : "ltr"}
    >
      {showContent ? children : <AnalyticsSectionSkeleton lines={skeletonLines} isAr={isAr} />}
    </div>
  );
};

export default memo(DeferredAnalyticsSection);
