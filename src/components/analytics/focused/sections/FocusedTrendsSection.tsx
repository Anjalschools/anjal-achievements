"use client";

import { memo, type ReactNode } from "react";
import { SectionErrorBoundary } from "@/components/analytics/SectionErrorBoundary";
import { FocusedEmptyState } from "@/components/analytics/focused/FocusedEmptyState";
import { FocusedFacetClientGate } from "@/components/analytics/focused/FocusedFacetClientGate";
import type { FocusedFacetSectionProps } from "@/components/analytics/focused/sections/types";

type Props = FocusedFacetSectionProps<Array<{ year: number }>> & {
  isAr: boolean;
  children: ReactNode;
};

export const FocusedTrendsSection = memo(({ isAr, loading, error, data, onRetry, children }: Props) => {
  if (loading) return null;
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        <p className="font-black">{isAr ? "تعذر تحميل تحليلات الاتجاهات" : "Could not load trend analytics"}</p>
        <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold">
          {isAr ? "إعادة المحاولة" : "Retry"}
        </button>
      </div>
    );
  }
  if (!data?.length) return <FocusedEmptyState isAr={isAr} title={isAr ? "لا توجد اتجاهات" : "No trends"} />;
  return (
    <SectionErrorBoundary section="trends" isAr={isAr} onRetry={onRetry}>
      <FocusedFacetClientGate>{children}</FocusedFacetClientGate>
    </SectionErrorBoundary>
  );
});
FocusedTrendsSection.displayName = "FocusedTrendsSection";

