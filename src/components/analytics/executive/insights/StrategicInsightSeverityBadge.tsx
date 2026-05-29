"use client";

import { memo } from "react";
import type { StrategicInsightCardType } from "@/lib/analytics/intelligence/analytics-insight-card-type";
import type { InsightSeverity } from "@/lib/analytics/intelligence/analytics-narrative-schema";

const SEVERITY_STYLES: Record<InsightSeverity, string> = {
  CRITICAL: "bg-rose-100 text-rose-900 ring-rose-200",
  WARNING: "bg-amber-100 text-amber-950 ring-amber-200",
  OPPORTUNITY: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  SUCCESS: "bg-teal-100 text-teal-900 ring-teal-200",
  STABILITY: "bg-sky-100 text-sky-900 ring-sky-200",
  INFO: "bg-indigo-100 text-indigo-900 ring-indigo-200",
};

const CARD_TYPE_LABEL: Record<StrategicInsightCardType, { ar: string; en: string }> = {
  opportunity: { ar: "فرصة", en: "Opportunity" },
  warning: { ar: "تحذير", en: "Warning" },
  critical: { ar: "حرج", en: "Critical" },
  stability: { ar: "استقرار", en: "Stability" },
  growth: { ar: "نمو", en: "Growth" },
  decline: { ar: "تراجع", en: "Decline" },
  equity: { ar: "عدالة", en: "Equity" },
  recommendation: { ar: "توصية", en: "Recommendation" },
  exploratory: { ar: "استكشافي", en: "Exploratory" },
};

export type StrategicInsightSeverityBadgeProps = {
  isAr: boolean;
  severity: InsightSeverity;
  cardType: StrategicInsightCardType;
};

const StrategicInsightSeverityBadge = memo(
  ({ isAr, severity, cardType }: StrategicInsightSeverityBadgeProps) => {
    const label = CARD_TYPE_LABEL[cardType];
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ring-1 ${SEVERITY_STYLES[severity]}`}
      >
        {isAr ? label.ar : label.en}
      </span>
    );
  }
);

StrategicInsightSeverityBadge.displayName = "StrategicInsightSeverityBadge";

export default StrategicInsightSeverityBadge;
