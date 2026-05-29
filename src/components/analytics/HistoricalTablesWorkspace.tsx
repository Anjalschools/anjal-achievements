"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState, memo } from "react";
import { Loader2, FileDown, FileSpreadsheet, RefreshCw } from "lucide-react";
import { useAnalyticsFilters } from "@/contexts/AnalyticsFilterContext";
import {
  fetchHistoricalYearSlices,
  type HistoricalDimensionSlice,
} from "@/lib/analytics/historical-comparison-fetch";
import { buildSmartHistoricalBundle } from "@/lib/analytics/analytics-smart-table-builder";
import { deduplicateHistoricalQuery } from "@/lib/analytics/historical-query-dedup";
import { buildDeterministicFilterHash } from "@/lib/analytics/analytics-filter-stabilizer";
import HistoricalQuerySummaryBar from "@/components/analytics/HistoricalQuerySummaryBar";
import HistoricalComparisonQuickFilters from "@/components/analytics/HistoricalComparisonQuickFilters";
import HistoricalCompetitionSummaryBar from "@/components/analytics/HistoricalCompetitionSummaryBar";
import DeferredAnalyticsSection from "@/components/analytics/DeferredAnalyticsSection";
import HistoricalIntelligenceDeferredLoader from "@/components/analytics/HistoricalIntelligenceDeferredLoader";
import type { ComparisonTableMode } from "@/lib/analytics/historical-comparison-table-engine";
import { ACTIVITY_FAMILIES } from "@/lib/analytics/historical-comparison-table-engine";
import HistoricalComparisonTable from "@/components/analytics/tables/HistoricalComparisonTable";
import UnifiedCompetitionAnalyticsBlock from "@/components/competitions/UnifiedCompetitionAnalyticsBlock";
import { competitionConfigByTaxonomy } from "@/lib/competitions/competition-configs";
import HistoricalTableSkeleton from "@/components/analytics/tables/HistoricalTableSkeleton";
import HistoricalTableRenderBoundary from "@/components/analytics/tables/HistoricalTableRenderBoundary";
import HistoricalEmptyStateCard from "@/components/analytics/tables/HistoricalEmptyStateCard";
import EducationalMatrixTable from "@/components/analytics/tables/EducationalMatrixTable";
import {
  exportHistoricalTableToExcel,
  printHistoricalTablePdf,
} from "@/lib/analytics/analytics-table-export-engine";
import {
  type DrillChartPayload,
  type DrillChartSource,
} from "@/lib/analytics/analytics-drilldown-router";
import { t } from "@/lib/analytics/analytics-semantic-registry";
import IntelligenceCollapsibleSection from "@/components/analytics/IntelligenceCollapsibleSection";
import { buildStrategicNarratives } from "@/lib/analytics/analytics-strategic-narratives";
import { buildMultiMetricTrendBundle } from "@/lib/analytics/historical-trend-engine";
import TalentProgressionFunnel from "@/components/analytics/funnels/TalentProgressionFunnel";
import OlympiadPipelineFunnel from "@/components/analytics/funnels/OlympiadPipelineFunnel";
import HistoricalExecutiveIntelligence from "@/components/analytics/HistoricalExecutiveIntelligence";
import { buildHistoricalEducationalIntelligence } from "@/lib/analytics/historical-educational-intelligence";
import { buildCompetitionResultsSummary } from "@/lib/analytics/historical-results-summary";
import { buildHistoricalRequestFingerprint } from "@/lib/analytics/historical-request-fingerprint";
import { buildTableExecutiveInsights } from "@/lib/analytics/historical-table-executive-enrichment";
import { computeWithFingerprint } from "@/lib/analytics/analytics-computation-graph";
import {
  countSourceRecords,
  isMatrixDebugEnabled,
  logMatrixDebug,
  summarizeFilters,
} from "@/lib/analytics/ai/executive-intelligence/matrix-debugger";
import { useDeterministicHistoricalState } from "@/hooks/useDeterministicHistoricalState";
import {
  deterministicHistoricalSnapshot,
  stableAnalyticsHash,
} from "@/lib/analytics/historical-analytics-stable";
import { useClientMounted } from "@/hooks/useClientMounted";
import {
  groupYearsIntoPageBlocks,
  sliceModelToYearBlock,
} from "@/lib/analytics/historical-pagination-layout";
import { computeRenderingBudget } from "@/lib/analytics/adaptive-rendering-budget";

const HistoricalTablesWorkspace = ({ isAr }: { isAr: boolean }) => {
  const { f, applyDrillFromChart } = useAnalyticsFilters();
  const loc = isAr ? "ar" : "en";
  const mounted = useClientMounted();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slices, setSlices] = useState<Awaited<ReturnType<typeof fetchHistoricalYearSlices>>>([]);
  const deferredSlices = useDeferredValue(slices);

  const filterHash = useMemo(() => buildDeterministicFilterHash(f), [f]);

  const hist = useDeterministicHistoricalState(f.activityYears, deferredSlices);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await deduplicateHistoricalQuery(
        f,
        hist.years,
        () => fetchHistoricalYearSlices(f, hist.years, hist.dimension),
        { dimension: hist.dimension, familyKey: hist.familyKey }
      );
      setSlices(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load historical data");
      setSlices([]);
    } finally {
      setLoading(false);
    }
  }, [f, hist.years, hist.dimension, filterHash]);

  useEffect(() => {
    if (!mounted) return;
    void load();
  }, [load, mounted]);

  const bundleHash = useMemo(
    () =>
      deferredSlices.length > 0
        ? deterministicHistoricalSnapshot({
            years: hist.years,
            dimension: hist.dimension,
            mode: hist.mode,
            familyKey: hist.familyKey,
            displayMode: hist.displayMode,
            tableCount: deferredSlices[0]?.payload.table.length ?? 0,
            participations: deferredSlices[deferredSlices.length - 1]?.payload.kpis.totalParticipations ?? 0,
          })
        : "empty",
    [deferredSlices, hist.yearsKey, hist.dimension, hist.mode, hist.familyKey, hist.displayMode]
  );

  const requestFingerprint = useMemo(
    () =>
      buildHistoricalRequestFingerprint({
        filter: f,
        years: hist.years,
        dimension: hist.dimension,
        familyKey: hist.familyKey,
        displayMode: hist.displayMode,
      }),
    [filterHash, hist.yearsKey, hist.dimension, hist.familyKey, hist.displayMode]
  );

  const bundle = useMemo(() => {
    if (deferredSlices.length === 0) return null;
    return buildSmartHistoricalBundle(f, deferredSlices, hist.mode, hist.displayMode);
  }, [bundleHash, requestFingerprint]);

  const filteredTables = useMemo(() => {
    if (!bundle) return [];
    if (hist.familyKey === "all") return bundle.tables;
    return bundle.tables.filter((t) => t.activityFamilyKey === hist.familyKey);
  }, [bundle, hist.familyKey]);

  const tableRenderPolicy = useMemo(() => {
    if (!filteredTables[0]) return null;
    return computeRenderingBudget(filteredTables[0], hist.displayMode);
  }, [filteredTables, hist.displayMode]);

  const yearBlocks = useMemo(() => {
    if (!filteredTables[0]) return [];
    return groupYearsIntoPageBlocks(
      filteredTables[0].yearGroups,
      tableRenderPolicy?.recommendedYearsPerBlock ?? 2
    );
  }, [filteredTables, tableRenderPolicy]);

  const [activeYearBlockId, setActiveYearBlockId] = useState<string>("all");

  useEffect(() => {
    if (yearBlocks.length === 0) return;
    if (yearBlocks.some((b) => b.id === activeYearBlockId)) return;
    setActiveYearBlockId(yearBlocks[0]!.id);
  }, [yearBlocks, activeYearBlockId]);

  const competitionSummary = useMemo(() => {
    if (!bundle) return null;
    return buildCompetitionResultsSummary(deferredSlices, bundle.tables);
  }, [bundleHash, bundle?.tables.length]);

  const latestPayload = deferredSlices[deferredSlices.length - 1]?.payload ?? null;

  const strategicNarratives = useMemo(() => {
    if (!latestPayload || deferredSlices.length < 2) return [];
    return buildStrategicNarratives({
      general: latestPayload,
      historicalSlices: deferredSlices,
    });
  }, [latestPayload, deferredSlices.length, bundleHash]);

  const trendBundle = useMemo(() => {
    if (deferredSlices.length < 2) return [];
    return buildMultiMetricTrendBundle(deferredSlices).slice(0, 2);
  }, [bundleHash]);

  const historicalIntelligence = useMemo(() => {
    if (deferredSlices.length < 2 || !bundle) return null;
    return computeWithFingerprint(
      "hist-educational-intelligence",
      `${requestFingerprint}|${bundleHash}`,
      () => buildHistoricalEducationalIntelligence(deferredSlices, bundle.tables)
    );
  }, [requestFingerprint, bundleHash, bundle?.tables.length]);

  useEffect(() => {
    if (!isMatrixDebugEnabled() || !bundle?.matrixMeta) return;
    logMatrixDebug("workspace", {
      selectedYears: hist.years,
      sliceCount: deferredSlices.length,
      sourceRecordCount: countSourceRecords(deferredSlices),
      normalizedActivities: deferredSlices.flatMap((s) =>
        s.payload.table.map((r) => r.activityKey ?? r.typeKey ?? "")
      ),
      activityKeys: bundle.matrix?.columnLabels.map((c) => c.key) ?? [],
      rowKeys: bundle.matrix?.rowLabels.map((r) => r.key) ?? [],
      matrixRowsLength: bundle.matrix?.rowLabels.length ?? 0,
      matrixColumnsLength: bundle.matrix?.columnLabels.length ?? 0,
      filtersSummary: summarizeFilters(f),
      valid: bundle.matrixMeta.valid,
      recoveryMode: bundle.matrixMeta.recoveryMode,
    });
  }, [bundleHash, bundle?.matrixMeta, bundle?.matrix, deferredSlices, hist.years, f]);

  const tableInsightsMap = useMemo(() => {
    if (!bundle) return {};
    const map: Record<string, ReturnType<typeof buildTableExecutiveInsights>> = {};
    for (const table of bundle.tables) {
      map[table.id] = buildTableExecutiveInsights(
        deferredSlices,
        table,
        historicalIntelligence?.tableOverlays[table.id],
        loc
      );
    }
    return map;
  }, [bundleHash, historicalIntelligence, loc]);

  const handleDrill = useCallback(
    (payload: {
      year: number;
      metricKey: string;
      rowKey: string;
      activityFamilyKey: string;
    }) => {
      const family = ACTIVITY_FAMILIES.find((x) => x.key === payload.activityFamilyKey);
      applyDrillFromChart("historical_cell", {
        key: payload.activityFamilyKey,
        competitionKey: payload.activityFamilyKey,
        year: payload.year,
        labelAr: family?.labelAr,
        labelEn: family?.labelEn,
        metricKey: payload.metricKey,
      });
    },
    [applyDrillFromChart]
  );

  const handleResetFilters = useCallback(() => {
    hist.resetYears();
    hist.setFamilyKey("all");
    hist.setDimension("combined");
    hist.setDisplayMode("executive");
  }, [hist]);

  const filterSummaryAr =
    hist.dimension === "girls"
      ? "بنات فقط"
      : hist.dimension === "boys"
        ? "بنين فقط"
        : "بنين وبنات";
  const filterSummaryEn =
    hist.dimension === "girls"
      ? "Girls only"
      : hist.dimension === "boys"
        ? "Boys only"
        : "Boys & girls";

  const handleExportAllExcel = useCallback(() => {
    for (const table of filteredTables) {
      void exportHistoricalTableToExcel(
        table,
        isAr,
        `competition-${table.activityFamilyKey}`,
        historicalIntelligence ?? undefined,
        {
          displayMode: hist.displayMode,
          tableInsights: tableInsightsMap[table.id],
        }
      );
    }
  }, [filteredTables, isAr, historicalIntelligence, hist.displayMode, tableInsightsMap]);

  return (
    <div className="space-y-4" dir={isAr ? "rtl" : "ltr"}>
      {/* L1 — Header + actions */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h3 className="text-base font-black text-slate-900">
            {t("historical.workspace.title", loc)}
          </h3>
          <p className="mt-1 max-w-xl text-[11px] text-slate-500">
            {t("historical.workspace.hint", loc)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {isAr ? "تحديث" : "Refresh"}
          </button>
          {filteredTables.length > 0 ? (
            <>
              <button
                type="button"
                onClick={handleExportAllExcel}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-900"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel
              </button>
              {filteredTables[0] ? (
                <button
                  type="button"
                  onClick={() =>
                    printHistoricalTablePdf(
                      filteredTables[0]!,
                      isAr,
                      historicalIntelligence ?? undefined,
                      {
                        displayMode: hist.displayMode,
                        tableInsights: tableInsightsMap[filteredTables[0]!.id],
                      }
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[10px] font-bold text-indigo-900"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  PDF
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {/* L2 — Quick comparison filters */}
      <HistoricalComparisonQuickFilters
        isAr={isAr}
        mode={hist.mode}
        displayMode={hist.displayMode}
        dimension={hist.dimension}
        familyKey={hist.familyKey}
        availableYears={hist.availableYears}
        selectedYears={hist.years}
        loading={loading}
        onModeChange={hist.setMode}
        onDisplayModeChange={hist.setDisplayMode}
        onDimensionChange={hist.setDimension}
        onFamilyChange={hist.setFamilyKey}
        onYearsChange={hist.setYears}
        onSelectAllYears={hist.selectAllYears}
        onSelectLast3={() => hist.selectLastYears(3)}
        onSelectLast5={() => hist.selectLastYears(5)}
        onReset={handleResetFilters}
        onRefresh={() => void load()}
      />

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-4 min-h-[200px]">
          <div className="flex items-center gap-2 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t("historical.loading", loc)}
          </div>
          <HistoricalTableSkeleton isAr={isAr} yearCount={hist.years.length || 3} />
        </div>
      ) : null}

      {!loading && bundle ? (
        <HistoricalQuerySummaryBar
          isAr={isAr}
          meta={bundle.resolution}
          strategy={bundle.tablesFallback.strategy}
          confidence={bundle.tablesFallback.fallbackConfidence}
        />
      ) : null}

      {/* L3 — Comparison tables (primary) */}
      {!loading && competitionSummary ? (
        <HistoricalCompetitionSummaryBar isAr={isAr} summary={competitionSummary} />
      ) : null}

      {!loading && yearBlocks.length > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-black text-slate-800">
            {isAr ? "صفحات السنوات" : "Year pages"}
          </p>
          <div className="flex flex-wrap gap-1">
            {yearBlocks.map((b) => {
              const active = b.id === activeYearBlockId;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setActiveYearBlockId(b.id)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-indigo-50"
                  }`}
                  aria-label={isAr ? `عرض سنوات ${b.labelAr}` : `Show years ${b.labelEn}`}
                >
                  {isAr ? b.labelAr : b.labelEn}
                </button>
              );
            })}
          </div>
          {tableRenderPolicy?.exceedsBudget ? (
            <p className="text-[10px] font-semibold text-amber-700" dir="auto">
              {isAr ? tableRenderPolicy.reasonAr : tableRenderPolicy.reasonEn}
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading
        ? filteredTables.map((table) => (
            (() => {
              const block =
                yearBlocks.find((b) => b.id === activeYearBlockId) ?? yearBlocks[0] ?? null;
              const pagedModel = block ? sliceModelToYearBlock(table, block) : table;
              return (
            <IntelligenceCollapsibleSection
              key={table.id}
              id={`hist-${table.id}`}
              title={isAr ? table.activityLabelAr : table.activityLabelEn}
              hint={isAr ? table.sectionTitleAr : table.sectionTitleEn}
              isAr={isAr}
              defaultOpen
              badge={String(Math.round(table.totals.grandTotal))}
            >
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void exportHistoricalTableToExcel(
                      table,
                      isAr,
                      `competition-${table.activityFamilyKey}`,
                      historicalIntelligence ?? undefined,
                      {
                        displayMode: hist.displayMode,
                        tableInsights: tableInsightsMap[table.id],
                      }
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-900"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    printHistoricalTablePdf(table, isAr, historicalIntelligence ?? undefined, {
                      displayMode: hist.displayMode,
                      tableInsights: tableInsightsMap[table.id],
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-900"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  PDF
                </button>
              </div>
              {competitionConfigByTaxonomy(table.activityFamilyKey) ? (
                <div className="mb-4">
                  <UnifiedCompetitionAnalyticsBlock
                    isAr={isAr}
                    competitionKey={table.activityFamilyKey}
                    years={hist.years}
                    displayYears={block?.years}
                    dimension={hist.dimension}
                    sectionTitleAr={table.sectionTitleAr}
                    sectionTitleEn={table.sectionTitleEn}
                  />
                </div>
              ) : (
                <HistoricalTableRenderBoundary tableId={table.id} isAr={isAr}>
                  <HistoricalComparisonTable
                    isAr={isAr}
                    model={pagedModel}
                    intelligenceOverlay={historicalIntelligence?.tableOverlays[table.id]}
                    tableInsights={tableInsightsMap[table.id]}
                    displayMode={hist.displayMode}
                    compact={hist.mode === "executive" || hist.displayMode === "executive"}
                    requestedYears={hist.years}
                    filterSummaryAr={filterSummaryAr}
                    filterSummaryEn={filterSummaryEn}
                    onResetFilters={handleResetFilters}
                    onDrill={handleDrill}
                  />
                </HistoricalTableRenderBoundary>
              )}
            </IntelligenceCollapsibleSection>
              );
            })()
          ))
        : null}

      {!loading && filteredTables.length === 0 && !bundle?.resolution.availability.hasPartialSignal ? (
        <HistoricalEmptyStateCard
          isAr={isAr}
          reasonAr={t("historical.empty", loc)}
          reasonEn={t("historical.empty", loc)}
          requestedYears={hist.years}
          filterSummaryAr={filterSummaryAr}
          filterSummaryEn={filterSummaryEn}
          suggestionsAr={[
            "وسّع السنوات المحددة (آخر 3 أو 5)",
            "اختر «كل الأنشطة»",
            "أزل فلتر النتيجة من الفلاتر المتقدمة",
            "جرّب قسمًا آخر (بنين / بنات)",
          ]}
          suggestionsEn={[
            "Expand years (last 3 or 5)",
            "Select «All activities»",
            "Remove result filter from advanced filters",
            "Try another section (boys / girls)",
          ]}
          onResetFilters={handleResetFilters}
        />
      ) : null}

      {!loading && filteredTables.length === 0 && bundle?.resolution.availability.hasPartialSignal ? (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-xs font-black text-amber-900">
            {isAr ? "وضع استكشافي" : "Exploratory mode"} ·{" "}
            {isAr ? "ثقة" : "Confidence"} {bundle.tablesFallback.fallbackConfidence}%
          </p>
          {bundle.resolution.relaxation.reasonAr ? (
            <p className="text-[10px] text-amber-800">{bundle.resolution.relaxation.reasonAr}</p>
          ) : null}
        <HistoricalEmptyStateCard
          isAr={isAr}
          reasonAr="تحليل تاريخي للمسابقات — إشارة جزئية"
          reasonEn="Historical competition analysis — partial signal"
          requestedYears={hist.years}
          filterSummaryAr={bundle.tablesFallback.fallbackReason}
          filterSummaryEn={bundle.tablesFallback.fallbackReasonEn}
          suggestionsAr={[
            "وسّع السنوات المحددة",
            "أزل فلاتر النتيجة أو المستوى",
            "اختر كل الأنشطة",
          ]}
          suggestionsEn={[
            "Expand selected years",
            "Remove result or level filters",
            "Select all activities",
          ]}
          onResetFilters={handleResetFilters}
        />
        </div>
      ) : null}

      {/* L4 — Executive historical insights (accordion stable outside deferred loader) */}
      {!loading && deferredSlices.length >= 2 ? (
        <DeferredAnalyticsSection isAr={isAr} skeletonLines={8}>
          <IntelligenceCollapsibleSection
            id="hist-executive-intelligence"
            title={
              isAr
                ? "التحليل التنفيذي لنتائج المسابقات"
                : "Executive Competition Results Analysis"
            }
            isAr={isAr}
            defaultOpen={false}
            badge={
              historicalIntelligence
                ? String(historicalIntelligence.alerts.length)
                : undefined
            }
          >
            <HistoricalIntelligenceDeferredLoader
              isAr={isAr}
              contentKey={bundleHash}
              enabled={deferredSlices.length >= 2 && Boolean(bundle)}
              build={() =>
                historicalIntelligence ? (
                  <HistoricalExecutiveIntelligence
                    isAr={isAr}
                    intelligence={historicalIntelligence}
                    onDrill={(source: DrillChartSource, payload: DrillChartPayload) =>
                      applyDrillFromChart(source, payload)
                    }
                  />
                ) : (
                  <HistoricalTableSkeleton isAr={isAr} rowCount={4} />
                )
              }
            />
          </IntelligenceCollapsibleSection>
        </DeferredAnalyticsSection>
      ) : null}

      {/* L5 — Comparison matrix */}
      {!loading && bundle ? (
        <DeferredAnalyticsSection isAr={isAr} skeletonLines={5}>
          <IntelligenceCollapsibleSection
            id="hist-matrix"
            title={t("historical.matrix.title", loc)}
            isAr={isAr}
            defaultOpen={false}
          >
            <EducationalMatrixTable
              isAr={isAr}
              model={bundle.matrix}
              meta={bundle.matrixMeta}
            />
          </IntelligenceCollapsibleSection>
        </DeferredAnalyticsSection>
      ) : null}

      {!loading && latestPayload && deferredSlices.length > 0 ? (
        <DeferredAnalyticsSection isAr={isAr} skeletonLines={6}>
          <IntelligenceCollapsibleSection
            id="hist-funnels"
            title={isAr ? "مسارات المسابقات" : "Competition pipelines"}
            isAr={isAr}
            defaultOpen={false}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TalentProgressionFunnel data={latestPayload} isAr={isAr} />
              <OlympiadPipelineFunnel data={latestPayload} isAr={isAr} />
            </div>
          </IntelligenceCollapsibleSection>
        </DeferredAnalyticsSection>
      ) : null}

      {/* L6 — Deep strategic intelligence */}
      {!loading && latestPayload && deferredSlices.length >= 2 ? (
        <DeferredAnalyticsSection isAr={isAr} skeletonLines={4}>
          <IntelligenceCollapsibleSection
            id="hist-strategic"
            title={isAr ? "الذكاء الاستراتيجي العميق" : "Deep strategic intelligence"}
            isAr={isAr}
            defaultOpen={false}
          >
            {trendBundle.length > 0 ? (
              <ul className="space-y-2">
                {trendBundle.flatMap((tr) =>
                  tr.narratives.slice(0, 1).map((n) => (
                    <li
                      key={`${tr.metricId}-${n.id}`}
                      className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-xs text-slate-800"
                    >
                      {isAr ? n.bodyAr : n.bodyEn}
                    </li>
                  ))
                )}
              </ul>
            ) : null}
            {strategicNarratives.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {strategicNarratives.slice(0, 4).map((n) => (
                  <li key={n.id} className="text-[11px] text-slate-600">
                    {isAr ? n.bodyAr : n.bodyEn}
                  </li>
                ))}
              </ul>
            ) : null}
          </IntelligenceCollapsibleSection>
        </DeferredAnalyticsSection>
      ) : null}
    </div>
  );
};

export default memo(HistoricalTablesWorkspace);
