"use client";

import type { SpecialAchievementHighlightBadge as BadgeData } from "@/lib/achievement-report-category";

type Props = {
  badge: BadgeData;
  isArabic: boolean;
  className?: string;
};

const toneByKey: Record<BadgeData["key"], string> = {
  early_university: "bg-indigo-50 text-indigo-900 ring-indigo-200",
  entrepreneurship: "bg-amber-50 text-amber-950 ring-amber-200",
};

const SpecialAchievementHighlightBadge = ({ badge, isArabic, className = "" }: Props) => {
  const label = isArabic ? badge.labelAr : badge.labelEn;
  const tone = toneByKey[badge.key] || "bg-slate-50 text-slate-800 ring-slate-200";

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold leading-tight ring-1 ${tone} ${className}`}
      title={label}
    >
      {label}
    </span>
  );
};

export default SpecialAchievementHighlightBadge;
