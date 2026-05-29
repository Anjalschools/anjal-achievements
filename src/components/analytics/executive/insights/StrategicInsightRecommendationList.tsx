"use client";

import { memo } from "react";

export type StrategicInsightRecommendationListProps = {
  isAr: boolean;
  recommendation?: string;
};

const StrategicInsightRecommendationList = memo(
  ({ isAr, recommendation }: StrategicInsightRecommendationListProps) => {
    if (!recommendation) return null;
    return (
      <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-2">
        <p className="text-[9px] font-black uppercase tracking-wide text-teal-800">
          {isAr ? "توصية تنفيذية" : "Executive recommendation"}
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-teal-950" dir="auto">
          {recommendation}
        </p>
      </div>
    );
  }
);

StrategicInsightRecommendationList.displayName = "StrategicInsightRecommendationList";

export default StrategicInsightRecommendationList;
