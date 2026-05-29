"use client";

import { memo, type ReactNode } from "react";
import { ChartErrorBoundary } from "@/components/analytics/ChartErrorBoundary";
import { FocusedEmptyState } from "@/components/analytics/focused/FocusedEmptyState";
import { FocusedFacetClientGate } from "@/components/analytics/focused/FocusedFacetClientGate";
import { ChartsSkeleton } from "@/components/analytics/focused/skeletons/ChartsSkeleton";
import type { FocusedFacetSectionProps } from "@/components/analytics/focused/sections/types";

type Props = FocusedFacetSectionProps<{ resultDonut?: unknown[]; yoyBars?: unknown[] }> & {
  isAr: boolean;
  children: ReactNode;
};

export const FocusedChartsSection = memo(({ isAr, loading, error, data, children }: Props) => {
  if (loading) return <ChartsSkeleton />;
  if (error) return <FocusedEmptyState isAr={isAr} title={isAr ? "تعذر تحميل الرسوم" : "Could not load charts"} />;
  if (!data?.resultDonut?.length && !data?.yoyBars?.length) {
    return <FocusedEmptyState isAr={isAr} title={isAr ? "لا توجد بيانات رسوم" : "No chart data"} />;
  }
  return (
    <ChartErrorBoundary chartId="focused-charts-section" isAr={isAr} minHeight={320}>
      <FocusedFacetClientGate fallback={<ChartsSkeleton />}>{children}</FocusedFacetClientGate>
    </ChartErrorBoundary>
  );
});
FocusedChartsSection.displayName = "FocusedChartsSection";

