"use client";

import { memo } from "react";
import { competitionConfigByTaxonomy, competitionConfigByKey } from "@/lib/competitions/competition-configs";
import type { HistoricalDimensionSlice } from "@/lib/analytics/historical-comparison-fetch";
import UnifiedCompetitionAnalyticsBlock from "@/components/competitions/UnifiedCompetitionAnalyticsBlock";

export type CompetitionAnalyticsSectionProps = {
  isAr: boolean;
  competitionKey: string;
  years?: number[];
  dimension?: HistoricalDimensionSlice;
  sectionTitleAr?: string;
  sectionTitleEn?: string;
};

const CompetitionAnalyticsSection = memo(
  ({
    isAr,
    competitionKey,
    years = [],
    dimension = "combined",
    sectionTitleAr,
    sectionTitleEn,
  }: CompetitionAnalyticsSectionProps) => {
    const config =
      competitionConfigByTaxonomy(competitionKey) ?? competitionConfigByKey(competitionKey);

    if (!config) {
      return (
        <p className="text-sm text-amber-800" dir={isAr ? "rtl" : "ltr"}>
          {isAr ? "لا يوجد إعداد لهذه المسابقة بعد." : "No table config for this competition yet."}
        </p>
      );
    }

    if (years.length === 0) {
      return (
        <p className="text-sm text-slate-600" dir={isAr ? "rtl" : "ltr"}>
          {isAr ? "اختر سنة واحدة على الأقل." : "Select at least one year."}
        </p>
      );
    }

    return (
      <UnifiedCompetitionAnalyticsBlock
        isAr={isAr}
        competitionKey={config.key}
        years={years}
        dimension={dimension}
        sectionTitleAr={sectionTitleAr}
        sectionTitleEn={sectionTitleEn}
      />
    );
  }
);

CompetitionAnalyticsSection.displayName = "CompetitionAnalyticsSection";
export default CompetitionAnalyticsSection;
