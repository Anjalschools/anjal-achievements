"use client";

import { memo, type ReactNode } from "react";
import { SectionErrorBoundary } from "@/components/analytics/SectionErrorBoundary";
import { FocusedEmptyState } from "@/components/analytics/focused/FocusedEmptyState";
import { FocusedFacetClientGate } from "@/components/analytics/focused/FocusedFacetClientGate";
import { ParticipantsSkeleton } from "@/components/analytics/focused/skeletons/ParticipantsSkeleton";
import type { FocusedFacetSectionProps } from "@/components/analytics/focused/sections/types";
import type { FocusedActivityParticipantRow } from "@/types/focused-activity-report";

type Props = FocusedFacetSectionProps<FocusedActivityParticipantRow[]> & {
  isAr: boolean;
  children: ReactNode;
};

export const FocusedParticipantsSection = memo(({ isAr, loading, error, data, onRetry, children }: Props) => {
  if (loading) return <ParticipantsSkeleton />;
  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        <p className="font-black">{isAr ? "تعذر تحميل جدول المشاركين" : "Could not load participant register"}</p>
        <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold">
          {isAr ? "إعادة المحاولة" : "Retry"}
        </button>
      </div>
    );
  }
  if (!data?.length) {
    return <FocusedEmptyState isAr={isAr} title={isAr ? "لا يوجد مشاركون" : "No participants found"} />;
  }
  return (
    <SectionErrorBoundary section="participants" isAr={isAr} onRetry={onRetry}>
      <FocusedFacetClientGate fallback={<ParticipantsSkeleton />}>{children}</FocusedFacetClientGate>
    </SectionErrorBoundary>
  );
});
FocusedParticipantsSection.displayName = "FocusedParticipantsSection";

