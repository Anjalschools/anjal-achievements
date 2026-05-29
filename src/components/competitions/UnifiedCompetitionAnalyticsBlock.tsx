"use client";

import { memo, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useAnalyticsFilters } from "@/contexts/AnalyticsFilterContext";
import { useCompetitionTableQuery } from "@/hooks/useCompetitionTableQuery";
import type { HistoricalDimensionSlice } from "@/lib/analytics/historical-comparison-fetch";
import { sliceCompetitionTableToYears } from "@/lib/analytics/competition-table-year-slice";
import CompetitionAnalyticsCard from "@/components/competitions/CompetitionAnalyticsCard";
import CompetitionAnalyticsTable from "@/components/competitions/CompetitionAnalyticsTable";

export type UnifiedCompetitionAnalyticsBlockProps = {
  isAr: boolean;
  competitionKey: string;
  years: number[];
  /** Optional year subset for paging */
  displayYears?: number[];
  dimension?: HistoricalDimensionSlice;
  sectionTitleAr?: string;
  sectionTitleEn?: string;
};

/**
 * Single-fetch executive block: KPIs + export + one competition summary table.
 */
const UnifiedCompetitionAnalyticsBlock = memo(
  ({
    isAr,
    competitionKey,
    years,
    displayYears,
    dimension = "combined",
    sectionTitleAr,
    sectionTitleEn,
  }: UnifiedCompetitionAnalyticsBlockProps) => {
    const { f, filterKey } = useAnalyticsFilters();

    const { model, loading, error, queryKey } = useCompetitionTableQuery({
      competitionKey,
      years,
      filter: f,
      filterKey,
      dimension,
      enabled: years.length > 0 && Boolean(competitionKey),
    });

    const displayModel = useMemo(() => {
      if (!model) return null;
      if (!displayYears?.length || displayYears.length === model.years.length) return model;
      return sliceCompetitionTableToYears(model, displayYears);
    }, [model, displayYears]);

    const sectionTitle = isAr
      ? sectionTitleAr ?? "قسم البنين والبنات"
      : sectionTitleEn ?? "Boys and girls section";

    if (loading) {
      return (
        <div className="flex items-center gap-2 text-sm text-slate-600" dir={isAr ? "rtl" : "ltr"}>
          <Loader2 className="h-4 w-4 animate-spin" />
          {isAr ? "جاري تحميل ملخص المسابقة…" : "Loading competition summary…"}
        </div>
      );
    }

    if (error) {
      return (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </p>
      );
    }

    if (!displayModel) return null;

    return (
      <div className="space-y-4" dir={isAr ? "rtl" : "ltr"} data-competition-query-key={queryKey}>
        <CompetitionAnalyticsCard
          isAr={isAr}
          model={displayModel}
          loading={loading}
          pdfMeta={{
            sectionTitleAr: sectionTitleAr ?? "قسم البنين والبنات",
            sectionTitleEn: sectionTitleEn ?? "Boys and girls section",
            filterSummaryAr:
              dimension === "girls"
                ? "بنات فقط"
                : dimension === "boys"
                  ? "بنين فقط"
                  : "بنين وبنات",
            filterSummaryEn:
              dimension === "girls"
                ? "Girls only"
                : dimension === "boys"
                  ? "Boys only"
                  : "Boys & girls",
          }}
        />

        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-800">
            {isAr ? "ملخص المسابقة التنفيذي" : "Executive competition summary"}
          </p>
          <CompetitionAnalyticsTable
            isAr={isAr}
            model={displayModel}
            sectionTitle={sectionTitle}
          />
        </div>
      </div>
    );
  }
);

UnifiedCompetitionAnalyticsBlock.displayName = "UnifiedCompetitionAnalyticsBlock";
export default UnifiedCompetitionAnalyticsBlock;
