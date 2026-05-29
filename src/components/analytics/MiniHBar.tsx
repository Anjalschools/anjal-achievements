"use client";

import type { CSSProperties } from "react";

export type MiniHBarProps = {
  label: string;
  value: number;
  max: number;
  isAr: boolean;
  barClassName?: string;
  barStyle?: CSSProperties;
  suffix?: string;
};

const MiniHBar = ({ label, value, max, isAr, barClassName, barStyle, suffix }: MiniHBarProps) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-[11px] font-bold text-slate-600">
        <span className="truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-slate-900">
          {value}
          {suffix ? ` ${suffix}` : ""}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" dir={isAr ? "rtl" : "ltr"}>
        <div
          className={barClassName ?? "h-full rounded-full bg-primary transition-[width]"}
          style={{ width: `${pct}%`, ...barStyle }}
        />
      </div>
    </div>
  );
};

export default MiniHBar;
