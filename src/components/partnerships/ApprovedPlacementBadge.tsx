"use client";

import { BadgeCheck } from "lucide-react";
import { APPROVED_PLACEMENT_BADGE } from "@/lib/partnerships/training-final-evaluation-ui-constants";

type ApprovedPlacementBadgeProps = {
  isAr: boolean;
  className?: string;
};

const ApprovedPlacementBadge = ({ isAr, className = "" }: ApprovedPlacementBadgeProps) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900 ${className}`}
  >
    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
    {isAr ? APPROVED_PLACEMENT_BADGE.ar : APPROVED_PLACEMENT_BADGE.en}
  </span>
);

export const approvedPlacementCardClass =
  "border-emerald-400 bg-emerald-50/80 shadow-md shadow-emerald-100/50 ring-1 ring-emerald-200";

export default ApprovedPlacementBadge;
