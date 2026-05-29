/**
 * Central historical intelligence resolution — availability, filters, fallback, matrix.
 */

import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import type { ActivityFamilyDef } from "@/lib/analytics/historical-comparison-table-engine";
import {
  assessHistoricalDataAvailability,
  type HistoricalAvailabilityReport,
} from "@/lib/analytics/historical-data-availability";
import {
  buildHistoricalTablesWithFallback,
  type HistoricalFallbackResult,
} from "@/lib/analytics/historical-fallback-strategies";
import {
  buildMatrixWithRecovery,
  type SafeMatrixResult,
} from "@/lib/analytics/historical-matrix-model";
import {
  resolveHistoricalCompatibleFilters,
  type HistoricalDimensionRelaxation,
  type HistoricalQueryFingerprint,
} from "@/lib/analytics/historical-query-resolution";
import { resolveHistoricalFilterPipeline } from "@/lib/analytics/historical-filter-resolution-pipeline";
import type { HistoricalTableDisplayMode } from "@/lib/analytics/historical-executive-table-theme";

export type HistoricalResolutionMeta = {
  fingerprint: HistoricalQueryFingerprint;
  relaxation: HistoricalDimensionRelaxation;
  availability: HistoricalAvailabilityReport;
  sparseMode: boolean;
  exploratoryMode: boolean;
};

export type HistoricalResolvedBundle = {
  tables: HistoricalComparisonTableModel[];
  tablesFallback: HistoricalFallbackResult<HistoricalComparisonTableModel[]>;
  matrix: SafeMatrixResult;
  meta: HistoricalResolutionMeta;
};

export const resolveHistoricalIntelligenceBundle = (
  filter: ExecutiveFilterSnapshot,
  slices: HistoricalYearSlice[],
  input?: {
    sectionTitleAr?: string;
    sectionTitleEn?: string;
    families?: ActivityFamilyDef[];
    includeMatrix?: boolean;
    displayMode?: HistoricalTableDisplayMode;
  }
): HistoricalResolvedBundle => {
  const availability = assessHistoricalDataAvailability(slices);
  const filterPipeline = resolveHistoricalFilterPipeline(filter, slices, {
    displayMode: input?.displayMode,
  });
  const { filter: compatible, relaxation, fingerprint } = {
    filter: filterPipeline.compatible,
    relaxation: filterPipeline.relaxation,
    fingerprint: filterPipeline.queryFingerprint,
  };

  const tablesFallback = buildHistoricalTablesWithFallback({
    slices,
    sectionTitleAr: input?.sectionTitleAr,
    sectionTitleEn: input?.sectionTitleEn,
    displayMode: input?.displayMode ?? "executive",
  });

  let tables = tablesFallback.data;
  if (input?.families && input.families.length > 0 && tables.length > 0) {
    const keys = new Set(input.families.map((f) => f.key));
    const filtered = tables.filter((t) => keys.has(t.activityFamilyKey));
    if (filtered.length > 0) tables = filtered;
  }

  const matrix = input?.includeMatrix === false
    ? {
        model: null,
        meta: {
          yearsCount: slices.length,
          dimensionsCount: 0,
          measuresCount: 0,
          normalizedRows: 0,
          sourceYear: 0,
          valid: false,
          recoveryMode: false,
          recoveryReasonAr: "",
          recoveryReasonEn: "",
        },
      }
    : buildMatrixWithRecovery(slices);

  const sparseMode =
    availability.hasPartialSignal &&
    (tablesFallback.partial || availability.sparsityRatio > 0.4);
  const exploratoryMode =
    tablesFallback.strategy === "EXPLORATORY" || tablesFallback.fallbackConfidence < 50;

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.info("[historical-resolution]", {
      years: fingerprint.years,
      tables: tables.length,
      matrixValid: matrix.meta.valid,
      strategy: tablesFallback.strategy,
      hasPartialSignal: availability.hasPartialSignal,
    });
  }

  return {
    tables,
    tablesFallback,
    matrix,
    meta: {
      fingerprint,
      relaxation,
      availability,
      sparseMode,
      exploratoryMode,
    },
  };
};
