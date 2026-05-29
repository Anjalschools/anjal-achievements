"use client";

import {
  ANALYTICS_COUNT_PERSPECTIVES,
  perspectiveDescription,
  perspectiveLabel,
  perspectiveLevelTag,
  type AnalyticsCountPerspective,
} from "@/lib/analytics/analytics-perspective";
import { t, type AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";

export type ParticipationPerspectiveBannerProps = {
  isAr: boolean;
  perspective: AnalyticsCountPerspective;
  onPerspectiveChange?: (p: AnalyticsCountPerspective) => void;
  compact?: boolean;
};

const ParticipationPerspectiveBanner = ({
  isAr,
  perspective,
  onPerspectiveChange,
  compact = false,
}: ParticipationPerspectiveBannerProps) => {
  const loc: AnalyticsLocale = isAr ? "ar" : "en";

  return (
    <div
      className={`rounded-xl border border-indigo-100 bg-indigo-50/40 print:hidden ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
      dir={isAr ? "rtl" : "ltr"}
      role="region"
      aria-label={t("perspective.banner.title", loc)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-800">
            {t("perspective.banner.title", loc)}
          </p>
          <p className="mt-0.5 text-xs font-black text-slate-900">
            {perspectiveLevelTag(perspective, loc)} · {perspectiveLabel(perspective, loc)}
          </p>
          {!compact ? (
            <p className="mt-1 max-w-2xl text-[11px] text-slate-600">{perspectiveDescription(perspective, loc)}</p>
          ) : null}
        </div>
        {onPerspectiveChange ? (
          <div
            className="flex flex-wrap gap-1 rounded-lg border border-indigo-200/80 bg-white p-0.5"
            role="group"
            aria-label={t("perspective.banner.title", loc)}
          >
            {ANALYTICS_COUNT_PERSPECTIVES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPerspectiveChange(p)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition ${
                  perspective === p
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-indigo-50"
                }`}
                aria-pressed={perspective === p}
              >
                {perspectiveLabel(p, loc)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ParticipationPerspectiveBanner;
