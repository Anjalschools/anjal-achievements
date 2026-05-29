"use client";

import { memo, useMemo } from "react";

export type HistoricalTimelineYearSelectorProps = {
  isAr: boolean;
  availableYears: number[];
  selectedYears: number[];
  onChange: (years: number[]) => void;
  onSelectLast3?: () => void;
  onSelectLast5?: () => void;
  onSelectAll?: () => void;
  disabled?: boolean;
};

const HistoricalTimelineYearSelector = ({
  isAr,
  availableYears,
  selectedYears,
  onChange,
  onSelectLast3,
  onSelectLast5,
  onSelectAll,
  disabled = false,
}: HistoricalTimelineYearSelectorProps) => {
  const timeline = useMemo(
    () => [...availableYears].sort((a, b) => a - b),
    [availableYears]
  );
  const selected = new Set(selectedYears);

  const handleToggle = (year: number) => {
    if (disabled) return;
    const next = selected.has(year)
      ? selectedYears.filter((y) => y !== year).sort((a, b) => a - b)
      : [...selectedYears, year].sort((a, b) => a - b);
    if (next.length > 0) onChange(next);
  };

  return (
    <div className="flex flex-col gap-2" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] font-bold text-slate-600">
          {isAr ? "الخط الزمني" : "Timeline"}
        </span>
        {onSelectAll ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onSelectAll}
            className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700"
          >
            {isAr ? "كل السنوات" : "All years"}
          </button>
        ) : null}
        {onSelectLast3 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onSelectLast3}
            className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700"
          >
            {isAr ? "آخر 3" : "Last 3"}
          </button>
        ) : null}
        {onSelectLast5 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onSelectLast5}
            className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700"
          >
            {isAr ? "آخر 5" : "Last 5"}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {timeline.map((year, i) => {
          const on = selected.has(year);
          return (
            <span key={year} className="inline-flex items-center gap-0.5">
              {i > 0 ? (
                <span className="text-[10px] text-slate-300" aria-hidden>
                  {isAr ? "←" : "→"}
                </span>
              ) : null}
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleToggle(year)}
                className={`min-w-[52px] rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-colors ${
                  on
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200"
                }`}
                aria-pressed={on}
              >
                {year}
              </button>
            </span>
          );
        })}
      </div>

      {selectedYears.length >= 2 ? (
        <p className="text-[9px] text-emerald-700">
          {isAr
            ? `وضع مقارنة: ${selectedYears.join(" · ")}`
            : `Compare mode: ${selectedYears.join(" · ")}`}
        </p>
      ) : (
        <p className="text-[9px] text-amber-700">
          {isAr ? "اختر سنتين على الأقل للمقارنة" : "Select at least 2 years to compare"}
        </p>
      )}
    </div>
  );
};

export default memo(HistoricalTimelineYearSelector);
