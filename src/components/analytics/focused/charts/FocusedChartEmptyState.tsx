"use client";

export const FocusedChartEmptyState = ({
  isAr,
  reason,
  onRelaxFilters,
  minHeight = 220,
}: {
  isAr: boolean;
  reason?: string;
  onRelaxFilters?: () => void;
  minHeight?: number;
}) => (
  <div
    className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center"
    style={{ minHeight }}
  >
    <p className="text-sm font-bold text-slate-800">{isAr ? "لا تتوفر بيانات للرسم" : "No chart data available"}</p>
    {reason ? <p className="mt-1 text-xs text-slate-500">{reason}</p> : null}
    {onRelaxFilters ? (
      <button
        type="button"
        onClick={onRelaxFilters}
        className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
      >
        {isAr ? "توسيع الفلاتر" : "Relax filters"}
      </button>
    ) : null}
  </div>
);

