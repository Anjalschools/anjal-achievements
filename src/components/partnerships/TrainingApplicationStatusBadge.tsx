"use client";

import type { StudentTrainingApplicationStatus } from "@/lib/partnerships/partnerships-constants";
import {
  trainingApplicationStatusBadgeClass,
  trainingApplicationStatusDotClass,
  trainingApplicationStatusLabel,
} from "@/lib/partnerships/partnerships-application-status-ui";

type TrainingApplicationStatusBadgeProps = {
  status: string;
  isAr: boolean;
  showDot?: boolean;
  size?: "sm" | "md";
  className?: string;
};

const SIZE_CLASS = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
};

const TrainingApplicationStatusBadge = ({
  status,
  isAr,
  showDot = true,
  size = "md",
  className = "",
}: TrainingApplicationStatusBadgeProps) => {
  const label = trainingApplicationStatusLabel(status, isAr);
  const badgeClass = trainingApplicationStatusBadgeClass(status);
  const dotClass = trainingApplicationStatusDotClass(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ring-1 ${SIZE_CLASS[size]} ${badgeClass} ${className}`}
      role="status"
      aria-label={isAr ? `حالة الطلب: ${label}` : `Application status: ${label}`}
    >
      {showDot ? (
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      ) : null}
      {label}
    </span>
  );
};

export const isTrainingApplicationStatus = (
  value: string
): value is StudentTrainingApplicationStatus =>
  [
    "submitted",
    "under_review",
    "interview_requested",
    "institution_review",
    "accepted",
    "rejected",
    "completed",
    "withdrawn",
  ].includes(value);

export default TrainingApplicationStatusBadge;
