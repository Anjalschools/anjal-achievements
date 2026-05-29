"use client";

import type { HistoricalResolutionMeta } from "@/lib/analytics/historical-resolution-pipeline";
import type { HistoricalFallbackStrategy } from "@/lib/analytics/historical-fallback-strategies";

export type HistoricalQuerySummaryBarProps = {
  isAr: boolean;
  meta: HistoricalResolutionMeta | null;
  strategy?: HistoricalFallbackStrategy;
  confidence?: number;
};

const HistoricalQuerySummaryBar = ({
  isAr,
  meta,
  strategy,
  confidence = 0,
}: HistoricalQuerySummaryBarProps) => {
  if (!meta) return null;

  const years = meta.fingerprint.years;
  const validCount = meta.availability.validYearCount;
  const excluded: string[] = [];
  if (meta.relaxation.droppedResultTokens) excluded.push(isAr ? "نتيجة" : "result");
  if (meta.relaxation.droppedLevels) excluded.push(isAr ? "مستوى" : "level");
  if (meta.relaxation.droppedGrades) excluded.push(isAr ? "صف" : "grade");

  const modeLabel = meta.exploratoryMode
    ? isAr
      ? "استكشافي"
      : "Exploratory"
    : meta.sparseMode
      ? isAr
        ? "متفرق"
        : "Sparse"
      : isAr
        ? "قياسي"
        : "Standard";

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-700"
      dir={isAr ? "rtl" : "ltr"}
      role="status"
      aria-label={isAr ? "ملخص الاستعلام التاريخي" : "Historical query summary"}
    >
      <span className="font-bold text-slate-900">
        {isAr ? "السنوات:" : "Years:"}{" "}
        {years.length > 0 ? years.join(" · ") : "—"}
      </span>
      <span>
        {isAr ? "صالحة:" : "Valid:"} {validCount}/{years.length || meta.availability.availableYears.length}
      </span>
      {strategy && strategy !== "STRICT" && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-900">
          {isAr ? "Fallback:" : "Fallback:"} {strategy}
        </span>
      )}
      <span>
        {isAr ? "الوضع:" : "Mode:"} {modeLabel}
      </span>
      {confidence > 0 && (
        <span>
          {isAr ? "ثقة:" : "Confidence:"} {confidence}%
        </span>
      )}
      {excluded.length > 0 && (
        <span className="text-slate-500">
          {isAr ? "مستبعد:" : "Excluded:"} {excluded.join(", ")}
        </span>
      )}
    </div>
  );
};

export default HistoricalQuerySummaryBar;
