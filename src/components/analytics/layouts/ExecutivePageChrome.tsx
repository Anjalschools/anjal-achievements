"use client";

import type { ReactNode } from "react";

export type ExecutivePageChromeProps = {
  title: string;
  subtitle?: string;
  isAr: boolean;
  controlBar?: ReactNode;
  belowControl?: ReactNode;
};

/**
 * Hero + control bar — title always full-width (no column squeeze / vertical word stacking).
 */
const ExecutivePageChrome = ({
  title,
  subtitle,
  isAr,
  controlBar,
  belowControl,
}: ExecutivePageChromeProps) => (
  <header className="executive-page-chrome mb-4 space-y-3 sm:mb-5" dir={isAr ? "rtl" : "ltr"}>
    <div className="executive-page-hero rounded-2xl border border-slate-200/90 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50/80 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
      <h1 className="executive-workspace-title text-text">{title}</h1>
      {subtitle ? <p className="executive-workspace-subtitle mt-2 text-text-light">{subtitle}</p> : null}
    </div>
    {controlBar ? (
      <div
        className="executive-control-bar rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3"
        role="toolbar"
        aria-label={isAr ? "أدوات التقرير التنفيذي" : "Executive report controls"}
      >
        {controlBar}
      </div>
    ) : null}
    {belowControl}
  </header>
);

export default ExecutivePageChrome;
