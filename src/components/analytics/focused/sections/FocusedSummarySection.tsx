"use client";

import { memo, type ReactNode, useEffect } from "react";
import { SectionErrorBoundary } from "@/components/analytics/SectionErrorBoundary";
import { FocusedEmptyState } from "@/components/analytics/focused/FocusedEmptyState";
import { FocusedFacetClientGate } from "@/components/analytics/focused/FocusedFacetClientGate";
import { SummarySkeleton } from "@/components/analytics/focused/skeletons/SummarySkeleton";
import type { FocusedFacetSectionProps } from "@/components/analytics/focused/sections/types";

type Props = FocusedFacetSectionProps<{ totalRecords: number }> & {
  isAr: boolean;
  hydrationEpoch: number;
  children: ReactNode;
};

export const FocusedSummarySection = memo(({ isAr, loading, error, data, onRetry, hydrationEpoch, children }: Props) => {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.info("[FOCUSED_SECTION_RENDER]", { section: "summary", hydrationEpoch, source: data ? "facet" : "fallback" });
    }
  }, [data, hydrationEpoch]);

  if (loading) return <SummarySkeleton />;
  if (error) {
    return (
      <FocusedEmptyState
        isAr={isAr}
        title={isAr ? "تعذر تحميل الملخص" : "Could not load summary"}
        subtitle={isAr ? "أعد المحاولة للمتابعة." : "Retry to continue."}
      />
    );
  }

  if (!data) {
    return <FocusedEmptyState isAr={isAr} />;
  }
  return (
    <SectionErrorBoundary section="summary" isAr={isAr} onRetry={onRetry}>
      <FocusedFacetClientGate fallback={<SummarySkeleton />}>{children}</FocusedFacetClientGate>
    </SectionErrorBoundary>
  );
});
FocusedSummarySection.displayName = "FocusedSummarySection";

