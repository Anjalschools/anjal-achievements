"use client";

import { memo } from "react";
import type { InsightConfidence } from "@/lib/analytics/intelligence/analytics-narrative-schema";

const CONFIDENCE_WIDTH: Record<InsightConfidence, string> = {
  HIGH: "w-full",
  MEDIUM: "w-2/3",
  LOW: "w-1/3",
  EXPLORATORY: "w-1/4",
};

const CONFIDENCE_SATURATION: Record<InsightConfidence, string> = {
  HIGH: "bg-indigo-600",
  MEDIUM: "bg-indigo-400",
  LOW: "bg-slate-400",
  EXPLORATORY: "bg-amber-400/70",
};

export type StrategicInsightConfidenceBarProps = {
  isAr: boolean;
  confidence: InsightConfidence;
};

const StrategicInsightConfidenceBar = memo(
  ({ isAr, confidence }: StrategicInsightConfidenceBarProps) => {
    const label =
      confidence === "HIGH"
        ? isAr
          ? "ثقة عالية"
          : "High confidence"
        : confidence === "MEDIUM"
          ? isAr
            ? "ثقة متوسطة"
            : "Medium confidence"
          : confidence === "LOW"
            ? isAr
              ? "ثقة منخفضة"
              : "Low confidence"
            : isAr
              ? "استكشافي"
              : "Exploratory";

    return (
      <div className="space-y-1" aria-label={label}>
        <div className="flex items-center justify-between gap-2 text-[9px] font-semibold text-slate-600">
          <span>{label}</span>
        </div>
        <div
          className={`h-1.5 overflow-hidden rounded-full bg-slate-100 ${
            confidence === "EXPLORATORY" ? "border border-dashed border-amber-300" : ""
          }`}
        >
          <div
            className={`h-full rounded-full transition-all ${CONFIDENCE_WIDTH[confidence]} ${CONFIDENCE_SATURATION[confidence]}`}
          />
        </div>
      </div>
    );
  }
);

StrategicInsightConfidenceBar.displayName = "StrategicInsightConfidenceBar";

export default StrategicInsightConfidenceBar;
