"use client";

import type { ReactNode } from "react";

export type ResponsiveAnalyticsGridProps = {
  children: ReactNode;
  className?: string;
  /** KPI grid density */
  kpiCols?: "auto" | "compact";
};

const ResponsiveAnalyticsGrid = ({ children, className = "", kpiCols = "auto" }: ResponsiveAnalyticsGridProps) => (
  <div
    className={`grid gap-3 sm:gap-4 ${
      kpiCols === "compact"
        ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    } ${className}`}
  >
    {children}
  </div>
);

export default ResponsiveAnalyticsGrid;
