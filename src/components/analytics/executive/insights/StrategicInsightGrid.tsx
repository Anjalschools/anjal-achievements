"use client";

import { memo } from "react";
import type { ExecutiveSemanticInsight } from "@/lib/analytics/intelligence/analytics-narrative-schema";
import StrategicInsightCard from "@/components/analytics/executive/insights/StrategicInsightCard";
import StrategicInsightEmptyState from "@/components/analytics/executive/insights/StrategicInsightEmptyState";

export type StrategicInsightGridProps = {
  isAr: boolean;
  insights: ExecutiveSemanticInsight[];
  filterCount?: number;
};

const StrategicInsightGrid = memo(({ isAr, insights, filterCount }: StrategicInsightGridProps) => {
  if (insights.length === 0) {
    return <StrategicInsightEmptyState isAr={isAr} filterCount={filterCount} />;
  }

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
      role="list"
      aria-label={isAr ? "بطاقات الرؤى الاستراتيجية" : "Strategic insight cards"}
    >
      {insights.map((insight) => (
        <div key={insight.id} role="listitem">
          <StrategicInsightCard isAr={isAr} insight={insight} />
        </div>
      ))}
    </div>
  );
});

StrategicInsightGrid.displayName = "StrategicInsightGrid";

export default StrategicInsightGrid;
