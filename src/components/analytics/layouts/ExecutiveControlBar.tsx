"use client";

import type { ReactNode } from "react";

export type ExecutiveControlBarGroupProps = {
  label?: string;
  isAr?: boolean;
  children: ReactNode;
};

export const ExecutiveControlBarGroup = ({ label, isAr, children }: ExecutiveControlBarGroupProps) => (
  <div className="flex min-w-0 flex-wrap items-center gap-2" dir={isAr ? "rtl" : "ltr"}>
    {label ? (
      <span className="w-full text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:w-auto sm:pe-1">
        {label}
      </span>
    ) : null}
    {children}
  </div>
);

export type ExecutiveControlBarProps = {
  isAr: boolean;
  children: ReactNode;
};

const ExecutiveControlBar = ({ isAr, children }: ExecutiveControlBarProps) => (
  <div
    className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    dir={isAr ? "rtl" : "ltr"}
  >
    {children}
  </div>
);

export default ExecutiveControlBar;
