"use client";

import type { MatrixDebugMeta } from "@/lib/analytics/historical-matrix-model";

export type HistoricalMatrixEmptyStateProps = {
  isAr: boolean;
  meta?: MatrixDebugMeta;
  partialSignal?: boolean;
};

const HistoricalMatrixEmptyState = ({
  isAr,
  meta,
  partialSignal = false,
}: HistoricalMatrixEmptyStateProps) => (
  <div
    className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center"
    role="status"
    dir={isAr ? "rtl" : "ltr"}
  >
    <p className="text-sm font-bold text-slate-700">
      {partialSignal
        ? isAr
          ? "إشارة تاريخية جزئية — جرّب توسيع السنوات أو إزالة فلاتر النتيجة."
          : "Partial historical signal — try more years or relax result filters."
        : isAr
          ? "لا توجد بيانات كافية لبناء مصفوفة المقارنة."
          : "Not enough data to build the comparison matrix."}
    </p>
    <p className="mt-2 text-[10px] text-slate-500">
      {isAr
        ? "وسّع السنوات المحددة أو اختر بعدًا مجمّعًا ثم حدّث البيانات."
        : "Expand selected years or try the combined dimension, then refresh."}
    </p>
    {meta && process.env.NODE_ENV !== "production" ? (
      <p className="mt-3 text-[9px] text-slate-400 tabular-nums">
        {isAr ? "تشخيص" : "Debug"}: {meta.yearsCount} {isAr ? "سنوات" : "years"} ·{" "}
        {meta.dimensionsCount}×{meta.measuresCount} · {meta.normalizedRows}{" "}
        {isAr ? "صفوف" : "rows"}
      </p>
    ) : null}
  </div>
);

export default HistoricalMatrixEmptyState;
