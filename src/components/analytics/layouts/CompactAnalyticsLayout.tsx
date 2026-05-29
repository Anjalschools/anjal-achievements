"use client";

import type { ReactNode } from "react";

export type CompactAnalyticsLayoutProps = {
  children: ReactNode;
  className?: string;
};

/** Dense layout for tablet / compact desktop */
const CompactAnalyticsLayout = ({ children, className = "" }: CompactAnalyticsLayoutProps) => (
  <div className={`analytics-compact space-y-3 text-sm ${className}`}>{children}</div>
);

export default CompactAnalyticsLayout;
