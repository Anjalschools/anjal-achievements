"use client";

import { memo, type ReactNode } from "react";

export type ExecutiveStickySectionHeaderProps = {
  isAr: boolean;
  title: string;
  hint?: string;
  badge?: string;
  actions?: ReactNode;
  sticky?: boolean;
};

const ExecutiveStickySectionHeader = memo(
  ({ isAr, title, hint, badge, actions, sticky = true }: ExecutiveStickySectionHeaderProps) => (
    <div
      className={`flex flex-wrap items-start justify-between gap-2 ${
        sticky ? "sticky top-14 z-20 bg-white/95 py-1 backdrop-blur-sm" : ""
      }`}
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-black text-slate-900">{title}</h3>
          {badge ? (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
              {badge}
            </span>
          ) : null}
        </div>
        {hint ? <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
);

ExecutiveStickySectionHeader.displayName = "ExecutiveStickySectionHeader";

export default ExecutiveStickySectionHeader;
