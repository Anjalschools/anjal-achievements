"use client";

import {
  PARENT_CONSENT_DISPLAY_LABELS,
  type ParentConsentDisplayStatus,
} from "@/lib/partnerships/parent-consent-constants";

const statusClass = (status: ParentConsentDisplayStatus) => {
  if (status === "approved") return "bg-emerald-50 text-emerald-900 border-emerald-200";
  if (status === "uploaded") return "bg-amber-50 text-amber-900 border-amber-200";
  if (status === "rejected") return "bg-red-50 text-red-900 border-red-200";
  if (status === "required") return "bg-violet-50 text-violet-900 border-violet-200";
  return "bg-gray-50 text-text-light border-border";
};

type ParentConsentStatusBadgeProps = {
  status: ParentConsentDisplayStatus;
  isAr: boolean;
  compact?: boolean;
};

const ParentConsentStatusBadge = ({ status, isAr, compact }: ParentConsentStatusBadgeProps) => {
  if (status === "not_required") return null;

  const label = PARENT_CONSENT_DISPLAY_LABELS[status][isAr ? "ar" : "en"];
  const title = isAr ? "موافقة ولي الأمر" : "Parent consent";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold ${compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"} ${statusClass(status)}`}
      title={title}
    >
      {compact ? label : `${title}: ${label}`}
    </span>
  );
};

export default ParentConsentStatusBadge;
