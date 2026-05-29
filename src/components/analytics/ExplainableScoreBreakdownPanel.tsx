"use client";

import { useState } from "react";
import type { ExplainableScoreBundle } from "@/lib/analytics/analytics-explainable-scores";
import { formatPercentage, formatScore } from "@/lib/analytics/analytics-number-formatting";
import type { AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";
import { t } from "@/lib/analytics/analytics-semantic-registry";

export type ExplainableScoreBreakdownPanelProps = {
  isAr: boolean;
  loc: AnalyticsLocale;
  titleKey: Parameters<typeof t>[0];
  bundle: ExplainableScoreBundle;
  accent?: "indigo" | "violet" | "teal";
};

const accentMap = {
  indigo: "border-indigo-200 bg-indigo-50",
  violet: "border-violet-200 bg-violet-50",
  teal: "border-teal-200 bg-teal-50",
};

const ExplainableScoreBreakdownPanel = ({
  isAr,
  loc,
  titleKey,
  bundle,
  accent = "indigo",
}: ExplainableScoreBreakdownPanelProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-xl border ${accentMap[accent]} px-3 py-2`} dir={isAr ? "rtl" : "ltr"}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between gap-2 text-start"
        aria-expanded={open}
      >
        <span className="text-[10px] font-bold text-slate-800">{t(titleKey, loc)}</span>
        <span className="text-sm font-black tabular-nums text-slate-900">
          {formatScore(bundle.score, loc)}
        </span>
      </button>
      {open ? (
        <div className="mt-3 space-y-2 border-t border-white/60 pt-2">
          {bundle.factors.map((f) => (
            <div key={f.id} className="rounded-lg bg-white/70 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-slate-800">
                  {isAr ? f.labelAr : f.labelEn}
                </p>
                <span className="text-[9px] font-semibold text-slate-500">
                  {formatPercentage(f.weightPct, loc)} {isAr ? "وزن" : "weight"}
                </span>
              </div>
              <div className="mt-1 h-1 w-full rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${
                    f.impact === "negative"
                      ? "bg-rose-500"
                      : f.impact === "positive"
                        ? "bg-emerald-500"
                        : "bg-slate-400"
                  }`}
                  style={{ width: `${Math.min(100, f.weightPct)}%` }}
                />
              </div>
              <p className="mt-1 text-[9px] text-slate-600">
                {isAr ? f.explanationAr : f.explanationEn}
              </p>
            </div>
          ))}
          {bundle.improvementAr.length > 0 ? (
            <ul className="list-inside list-disc text-[9px] text-slate-700">
              {(isAr ? bundle.improvementAr : bundle.improvementEn).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default ExplainableScoreBreakdownPanel;
