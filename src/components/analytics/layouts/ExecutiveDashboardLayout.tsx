"use client";

import type { ReactNode } from "react";

export type ExecutiveDashboardLayoutProps = {
  children: ReactNode;
  toolbar?: ReactNode;
  historyBar?: ReactNode;
  filters?: ReactNode;
  isAr: boolean;
  executiveMode?: boolean;
};

const ExecutiveDashboardLayout = ({
  children,
  toolbar,
  historyBar,
  filters,
  isAr,
  executiveMode,
}: ExecutiveDashboardLayoutProps) => (
  <div
    className={`analytics-layout w-full min-w-0 ${executiveMode ? "executive-mode" : ""}`}
    dir={isAr ? "rtl" : "ltr"}
    data-executive={executiveMode ? "1" : "0"}
  >
    {toolbar ? (
      <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">{toolbar}</div>
    ) : null}
    <div className="executive-dashboard-grid flex w-full min-w-0 flex-col gap-3 lg:gap-4">
      {historyBar ? <div className="min-w-0 print:hidden">{historyBar}</div> : null}
      {filters ? <div className="min-w-0 print:hidden">{filters}</div> : null}
      <div className="analytics-layout-body min-w-0 space-y-4 print:space-y-3">{children}</div>
    </div>
  </div>
);

export default ExecutiveDashboardLayout;
