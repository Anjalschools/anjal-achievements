"use client";

export type HistoricalYearMultiSelectorProps = {
  isAr: boolean;
  availableYears: number[];
  selectedYears: number[];
  onChange: (years: number[]) => void;
  onSelectAll?: () => void;
  onSelectLast3?: () => void;
  onSelectLast5?: () => void;
  onReset?: () => void;
  disabled?: boolean;
};

const HistoricalYearMultiSelector = ({
  isAr,
  availableYears,
  selectedYears,
  onChange,
  onSelectAll,
  onSelectLast3,
  onSelectLast5,
  onReset,
  disabled = false,
}: HistoricalYearMultiSelectorProps) => {
  const sortedAvailable = [...availableYears].sort((a, b) => a - b);
  const selectedSet = new Set(selectedYears);

  const handleToggle = (year: number) => {
    if (disabled) return;
    const on = selectedSet.has(year);
    const next = on
      ? selectedYears.filter((y) => y !== year).sort((a, b) => a - b)
      : [...selectedYears, year].sort((a, b) => a - b);
    if (next.length > 0) onChange(next);
  };

  return (
    <div className="flex flex-col gap-2" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] font-bold text-slate-600">
          {isAr ? "السنوات" : "Years"}
        </span>
        {onSelectAll ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onSelectAll}
            className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            {isAr ? "الكل" : "All"}
          </button>
        ) : null}
        {onSelectLast3 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onSelectLast3}
            className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            {isAr ? "آخر 3" : "Last 3"}
          </button>
        ) : null}
        {onSelectLast5 ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onSelectLast5}
            className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            {isAr ? "آخر 5" : "Last 5"}
          </button>
        ) : null}
        {onReset ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onReset}
            className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            {isAr ? "إعادة ضبط" : "Reset"}
          </button>
        ) : null}
      </div>

      <div
        className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2"
        role="group"
        aria-label={isAr ? "اختيار السنوات" : "Year selection"}
      >
        {sortedAvailable.map((year) => {
          const checked = selectedSet.has(year);
          return (
            <label
              key={`year-${year}`}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold transition ${
                checked
                  ? "border-indigo-400 bg-indigo-600 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              } ${disabled ? "pointer-events-none opacity-50" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => handleToggle(year)}
                className="h-3 w-3 rounded border-slate-300"
                aria-label={String(year)}
              />
              <span className="tabular-nums">{year}</span>
            </label>
          );
        })}
      </div>

      {selectedYears.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedYears.map((y) => (
            <span
              key={`chip-${y}`}
              className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-900"
            >
              {y}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default HistoricalYearMultiSelector;
