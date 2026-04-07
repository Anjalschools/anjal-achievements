"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AchievementScoreExplanation } from "@/lib/achievement-score-explain";

type Props = {
  locale: "ar" | "en";
  explanation: AchievementScoreExplanation;
};

const AchievementScoreDetail = ({ locale, explanation }: Props) => {
  const [open, setOpen] = useState(false);
  const isAr = locale === "ar";

  const handleToggle = () => setOpen((v) => !v);

  return (
    <div className="mt-2 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] to-transparent">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[11px] font-semibold text-primary hover:bg-primary/5"
      >
        <span>{isAr ? "تفاصيل احتساب النقاط" : "How points are calculated"}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          className="space-y-2 border-t border-primary/15 px-3 py-2 text-[11px] leading-relaxed text-text"
          dir={isAr ? "rtl" : "ltr"}
        >
          <p className="font-medium text-text-muted">{isAr ? "المعادلة" : "Formula"}</p>
          <p dir="ltr" className="rounded-lg bg-white/80 px-2 py-1.5 text-left font-mono text-[11px] text-text">
            {explanation.equationLtr}
          </p>
          {explanation.roundingNote ? (
            <p className="text-[10px] text-text-light">{explanation.roundingNote}</p>
          ) : null}
          <ul className="grid gap-1 sm:grid-cols-2">
            {explanation.lines.map((row) => (
              <li key={row.label} className="flex justify-between gap-2 rounded-md bg-white/60 px-2 py-1">
                <span className="text-text-muted">{row.label}</span>
                <span className="font-semibold tabular-nums text-text">{row.value}</span>
              </li>
            ))}
          </ul>
          {explanation.storedMismatchNote ? (
            <p className="rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-950">{explanation.storedMismatchNote}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default AchievementScoreDetail;
