"use client";

import { memo, type ReactNode } from "react";
import { SectionErrorBoundary } from "@/components/analytics/SectionErrorBoundary";
import { FocusedEmptyState } from "@/components/analytics/focused/FocusedEmptyState";
import { FocusedFacetClientGate } from "@/components/analytics/focused/FocusedFacetClientGate";
import { InsightsSkeleton } from "@/components/analytics/focused/skeletons/InsightsSkeleton";
import type { FocusedFacetSectionProps } from "@/components/analytics/focused/sections/types";

type Props = FocusedFacetSectionProps<{ narrativeAr?: string; narrativeEn?: string }> & {
  isAr: boolean;
  children: ReactNode;
};

export const FocusedInsightsSection = memo(({ isAr, loading, error, data, onRetry, children }: Props) => {
  if (loading) return <InsightsSkeleton />;
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        <p className="font-black">{isAr ? "تعذر تحميل الرؤى" : "Could not load insights"}</p>
        <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold">
          {isAr ? "إعادة المحاولة" : "Retry"}
        </button>
      </div>
    );
  }
  if (!data) return <FocusedEmptyState isAr={isAr} title={isAr ? "لا تتوفر رؤى" : "No insights available"} />;
  return (
    <SectionErrorBoundary section="insights" isAr={isAr} onRetry={onRetry}>
      <FocusedFacetClientGate fallback={<InsightsSkeleton />}>{children}</FocusedFacetClientGate>
    </SectionErrorBoundary>
  );
});
FocusedInsightsSection.displayName = "FocusedInsightsSection";

