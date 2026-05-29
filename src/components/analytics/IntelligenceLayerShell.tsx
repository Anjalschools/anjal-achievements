"use client";

import type { ReactNode } from "react";
import {
  INTELLIGENCE_LAYER_STYLES,
  type IntelligenceLayerLevel,
} from "@/lib/analytics/intelligence-workspace-hierarchy";

export type IntelligenceLayerShellProps = {
  level: IntelligenceLayerLevel;
  anchorId: string;
  title?: string;
  hint?: string;
  isAr: boolean;
  children: ReactNode;
  badge?: string;
};

const IntelligenceLayerShell = ({
  level,
  anchorId,
  title,
  hint,
  isAr,
  children,
  badge,
}: IntelligenceLayerShellProps) => {
  const style = INTELLIGENCE_LAYER_STYLES[level];

  return (
    <div
      id={anchorId}
      data-intel-layer={level}
      className={`scroll-mt-24 rounded-2xl border border-slate-200 bg-white/95 ${style.ring} ${style.emphasis} ${style.spacing} p-1 sm:p-2`}
      dir={isAr ? "rtl" : "ltr"}
    >
      {title ? (
        <div className="flex flex-wrap items-center gap-2 px-2 pt-2 sm:px-3">
          <span
            className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase ${style.badge}`}
          >
            L{level}
          </span>
          <h2 className="text-sm font-black text-slate-900">{title}</h2>
          {badge ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {badge}
            </span>
          ) : null}
          {hint ? <p className="w-full text-[10px] text-slate-500 sm:w-auto">{hint}</p> : null}
        </div>
      ) : null}
      <div className="px-1 pb-1 sm:px-2 sm:pb-2">{children}</div>
    </div>
  );
};

export default IntelligenceLayerShell;
