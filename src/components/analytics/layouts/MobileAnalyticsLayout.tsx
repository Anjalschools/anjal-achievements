"use client";

import type { ReactNode } from "react";

export type MobileAnalyticsLayoutProps = {
  children: ReactNode;
  stickyActions?: ReactNode;
  isAr: boolean;
};

/** Wraps analytics content with mobile-safe overflow and sticky action slot */
const MobileAnalyticsLayout = ({ children, stickyActions, isAr }: MobileAnalyticsLayoutProps) => (
  <div className="relative min-w-0" dir={isAr ? "rtl" : "ltr"}>
    <div className="analytics-mobile-content -mx-1 px-1 sm:mx-0 sm:px-0">{children}</div>
    {stickyActions ? (
      <div className="fixed bottom-4 z-40 flex w-full max-w-[calc(100vw-2rem)] justify-center gap-2 sm:hidden ltr:left-1/2 ltr:-translate-x-1/2 rtl:left-1/2 rtl:-translate-x-1/2">
        {stickyActions}
      </div>
    ) : null}
  </div>
);

export default MobileAnalyticsLayout;
