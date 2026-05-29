"use client";

import type { ReactNode } from "react";
import { useAnalyticsFilters } from "@/contexts/AnalyticsFilterContext";
import { AnalyticsPerspectiveProvider } from "@/lib/analytics/analytics-perspective-context";

/** Nests global perspective context inside analytics filter context (SSR-safe). */
const AnalyticsPerspectiveBridge = ({ children }: { children: ReactNode }) => {
  const { isAr } = useAnalyticsFilters();
  return <AnalyticsPerspectiveProvider isAr={isAr}>{children}</AnalyticsPerspectiveProvider>;
};

export default AnalyticsPerspectiveBridge;
