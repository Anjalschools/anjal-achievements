"use client";

import { memo } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import type { CompetitionTableModel } from "@/lib/analytics/competition-table-engine";
import { formatAcademicYearRangeLabel } from "@/lib/analytics/competition-year-normalizer";
import {
  exportCompetitionTableExcel,
  printCompetitionTablePdf,
  type CompetitionTablePdfMetadata,
} from "@/lib/competitions/competition-table-export";

export type CompetitionAnalyticsCardProps = {
  isAr: boolean;
  model: CompetitionTableModel;
  loading?: boolean;
  pdfMeta?: CompetitionTablePdfMetadata;
};

const CompetitionAnalyticsCard = memo(({ isAr, model, loading, pdfMeta }: CompetitionAnalyticsCardProps) => {
  const m = model.metrics;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900">
            {isAr ? model.competitionTitleAr : model.competitionTitleEn}
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            {isAr ? "إحصائيات ونتائج المسابقات" : "Competition statistics & results"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || !model.hasData}
            onClick={() => void exportCompetitionTableExcel(model, isAr)}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
            aria-label={isAr ? "تصدير Excel" : "Export Excel"}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </button>
          <button
            type="button"
            disabled={loading || !model.hasData}
            onClick={() => printCompetitionTablePdf(model, isAr, pdfMeta)}
            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
            aria-label={isAr ? "طباعة PDF" : "Print PDF"}
          >
            <FileDown className="h-3.5 w-3.5" />
            PDF
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-950">
          {isAr ? "جودة النتائج" : "Quality"}: {m.qualityScore}/100
        </span>
        {m.medalDensityPct != null && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">
            {isAr ? "كثافة الجوائز" : "Medal density"}: {m.medalDensityPct}%
          </span>
        )}
        {m.growthRatePct != null && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-950">
            {isAr ? "النمو السنوي" : "YoY growth"}: {m.growthRatePct > 0 ? "+" : ""}
            {m.growthRatePct}%
          </span>
        )}
        {m.bestYear && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
            {isAr ? "أفضل سنة" : "Best year"}: {formatAcademicYearRangeLabel(m.bestYear)}
          </span>
        )}
      </div>
    </div>
  );
});

CompetitionAnalyticsCard.displayName = "CompetitionAnalyticsCard";
export default CompetitionAnalyticsCard;
