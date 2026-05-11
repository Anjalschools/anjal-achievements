"use client";

import { memo, useId } from "react";

export type AlumniProfileCompletionRingProps = {
  pct: number;
  isAr: boolean;
  /** Secondary line under percentage */
  subtitle?: string;
  className?: string;
  size?: "sm" | "md";
};

const AlumniProfileCompletionRingInner = ({
  pct,
  isAr,
  subtitle,
  className = "",
  size = "md",
}: AlumniProfileCompletionRingProps) => {
  const uid = useId().replace(/:/g, "");
  const gradId = `alumni-completion-grad-${uid}`;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const dim = size === "sm" ? 72 : 96;
  const stroke = size === "sm" ? 6 : 7;
  const r = (dim - stroke) / 2;
  const c = dim / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (clamped / 100) * circumference;

  const label = isAr ? "اكتمال الملف" : "Profile completion";

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div className="relative" style={{ width: dim, height: dim }} role="img" aria-label={`${label}: ${clamped}%`}>
        <svg width={dim} height={dim} className="-rotate-90" aria-hidden>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgb(30, 58, 138)" />
              <stop offset="100%" stopColor="rgb(56, 189, 248)" />
            </linearGradient>
          </defs>
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-slate-200/90"
          />
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black tabular-nums text-slate-900">{clamped}%</span>
          <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
        </span>
      </div>
      {subtitle ? <p className="max-w-[200px] text-center text-[11px] font-semibold leading-snug text-slate-600">{subtitle}</p> : null}
    </div>
  );
};

export const AlumniProfileCompletionRing = memo(AlumniProfileCompletionRingInner);
AlumniProfileCompletionRing.displayName = "AlumniProfileCompletionRing";
