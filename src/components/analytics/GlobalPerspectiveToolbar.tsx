"use client";

import type { KeyboardEvent } from "react";
import {
  ANALYTICS_COUNT_PERSPECTIVES,
  useAnalyticsPerspective,
} from "@/lib/analytics/analytics-perspective-context";
import {
  perspectiveLabel,
  perspectiveDescription,
  type AnalyticsCountPerspective,
} from "@/lib/analytics/analytics-perspective";
import { t } from "@/lib/analytics/analytics-semantic-registry";

const GlobalPerspectiveToolbar = () => {
  const { perspective, setPerspective, loc, isAr, levelTag, hydrated } = useAnalyticsPerspective();

  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    p: AnalyticsCountPerspective,
    idx: number
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setPerspective(p);
      return;
    }
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? ANALYTICS_COUNT_PERSPECTIVES[(idx + 1) % ANALYTICS_COUNT_PERSPECTIVES.length]
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? ANALYTICS_COUNT_PERSPECTIVES[
              (idx - 1 + ANALYTICS_COUNT_PERSPECTIVES.length) % ANALYTICS_COUNT_PERSPECTIVES.length
            ]
          : null;
    if (next) {
      e.preventDefault();
      setPerspective(next);
      (e.currentTarget.parentElement?.querySelector(`[data-perspective="${next}"]`) as HTMLButtonElement)?.focus();
    }
  };

  return (
    <div
      className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 to-white px-4 py-3 shadow-sm print:hidden"
      dir={isAr ? "rtl" : "ltr"}
      role="region"
      aria-label={t("toolbar.perspective.title", loc)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-800">
            {t("toolbar.perspective.title", loc)}
          </p>
          <p className="mt-0.5 text-sm font-black text-slate-900">
            {levelTag} · {perspectiveLabel(perspective, loc)}
          </p>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-600">
            {perspectiveDescription(perspective, loc)}
          </p>
          {!hydrated ? (
            <p className="mt-1 text-[10px] text-slate-400" aria-live="polite">
              {isAr ? "جاري تحميل المنظور…" : "Loading perspective…"}
            </p>
          ) : null}
        </div>
        <div
          className="flex flex-wrap gap-1 rounded-xl border border-indigo-200/80 bg-white p-1 shadow-inner"
          role="toolbar"
          aria-label={t("toolbar.perspective.title", loc)}
        >
          {ANALYTICS_COUNT_PERSPECTIVES.map((p, idx) => (
            <button
              key={p}
              type="button"
              data-perspective={p}
              onClick={() => setPerspective(p)}
              onKeyDown={(e) => handleKeyDown(e, p, idx)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                perspective === p
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-600 hover:bg-indigo-50"
              }`}
              aria-pressed={perspective === p}
              title={perspectiveDescription(p, loc)}
              tabIndex={0}
            >
              {perspectiveLabel(p, loc)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GlobalPerspectiveToolbar;
