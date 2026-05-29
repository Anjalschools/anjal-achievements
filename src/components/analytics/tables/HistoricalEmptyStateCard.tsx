"use client";

import type { HistoricalTableValidationResult } from "@/lib/analytics/analytics-historical-table-validator";

export type HistoricalEmptyStateCardProps = {
  isAr: boolean;
  reasonAr: string;
  reasonEn: string;
  requestedYears?: number[];
  filterSummaryAr?: string;
  filterSummaryEn?: string;
  suggestionsAr?: string[];
  suggestionsEn?: string[];
  onResetFilters?: () => void;
  validation?: HistoricalTableValidationResult;
};

const HistoricalEmptyStateCard = ({
  isAr,
  reasonAr,
  reasonEn,
  requestedYears = [],
  filterSummaryAr,
  filterSummaryEn,
  suggestionsAr = [],
  suggestionsEn = [],
  onResetFilters,
  validation,
}: HistoricalEmptyStateCardProps) => {
  const suggestions = isAr ? suggestionsAr : suggestionsEn;

  return (
    <div
      className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-5 py-8 text-center"
      role="status"
      dir={isAr ? "rtl" : "ltr"}
    >
      <h4 className="text-sm font-black text-slate-800">{isAr ? reasonAr : reasonEn}</h4>

      {requestedYears.length > 0 ? (
        <p className="mt-2 text-[11px] text-slate-600">
          {isAr ? "السنوات المطلوبة: " : "Requested years: "}
          <span className="font-bold tabular-nums">{requestedYears.join(isAr ? "، " : ", ")}</span>
        </p>
      ) : null}

      {filterSummaryAr || filterSummaryEn ? (
        <p className="mt-1 text-[10px] text-slate-500">{isAr ? filterSummaryAr : filterSummaryEn}</p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="mx-auto mt-4 max-w-md list-inside list-disc space-y-1 text-start text-[10px] text-slate-600">
          {suggestions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      ) : null}

      {validation && validation.issues.length > 0 && process.env.NODE_ENV !== "production" ? (
        <p className="mt-3 text-[9px] text-amber-700">
          {validation.issues.slice(0, 2).map((i) => i.message).join(" · ")}
        </p>
      ) : null}

      {onResetFilters ? (
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-indigo-700"
        >
          {isAr ? "إعادة ضبط الفلاتر" : "Reset filters"}
        </button>
      ) : null}
    </div>
  );
};

export default HistoricalEmptyStateCard;
