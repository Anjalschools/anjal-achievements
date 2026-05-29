"use client";

import type { CSSProperties } from "react";
import MiniHBar from "@/components/analytics/MiniHBar";

export type DrillableMiniHBarProps = {
  label: string;
  value: number;
  max: number;
  isAr: boolean;
  barClassName?: string;
  barStyle?: CSSProperties;
  suffix?: string;
  onDrill?: () => void;
  drillLabel?: string;
  compact?: boolean;
};

const DrillableMiniHBar = ({
  onDrill,
  drillLabel,
  compact,
  ...barProps
}: DrillableMiniHBarProps) => {
  if (!onDrill) {
    return <MiniHBar {...barProps} />;
  }

  const hint = drillLabel ?? (barProps.isAr ? "استكشاف" : "Explore");

  return (
    <button
      type="button"
      onClick={onDrill}
      className={`w-full rounded-lg text-start transition hover:bg-indigo-50/60 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
        compact ? "p-1" : "p-1.5"
      }`}
      aria-label={`${barProps.label} — ${hint}`}
    >
      <MiniHBar {...barProps} />
      <span className="mt-0.5 block text-[10px] font-semibold text-indigo-600">{hint}</span>
    </button>
  );
};

export default DrillableMiniHBar;
