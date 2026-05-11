"use client";

import { memo } from "react";
import type { AlumniBadgeId } from "@/lib/alumni/alumni-badge-ids";
import { isAlumniBadgeId } from "@/lib/alumni/alumni-badge-ids";
import { alumniBadgeLabel } from "@/lib/alumni/alumni-badge-labels";

export type AlumniBadgeStripProps = {
  badges: string[];
  isAr: boolean;
  /** Max pills before "+N" */
  max?: number;
  className?: string;
  dense?: boolean;
};

const AlumniBadgeStripInner = ({
  badges,
  isAr,
  max = 5,
  className = "",
  dense = false,
}: AlumniBadgeStripProps) => {
  const valid = badges.map((b) => (isAlumniBadgeId(b) ? b : null)).filter((x): x is AlumniBadgeId => x != null);
  if (!valid.length) return null;
  const shown = valid.slice(0, max);
  const rest = valid.length - shown.length;

  const pill = dense ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]";

  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label={isAr ? "شارات الثقة" : "Trust badges"}>
      {shown.map((id) => (
        <li key={id}>
          <span
            className={`inline-flex rounded-full border border-amber-200/90 bg-gradient-to-r from-amber-50 to-white font-black uppercase tracking-wide text-amber-950 shadow-sm ring-1 ring-amber-100/80 ${pill}`}
          >
            {alumniBadgeLabel(id, isAr)}
          </span>
        </li>
      ))}
      {rest > 0 ? (
        <li>
          <span
            className={`inline-flex rounded-full border border-slate-200 bg-slate-50 font-black text-slate-600 ${pill}`}
          >
            +{rest}
          </span>
        </li>
      ) : null}
    </ul>
  );
};

export const AlumniBadgeStrip = memo(AlumniBadgeStripInner);
AlumniBadgeStrip.displayName = "AlumniBadgeStrip";
